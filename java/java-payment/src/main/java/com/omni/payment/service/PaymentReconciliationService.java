package com.omni.payment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.ReconciliationDetailResponse;
import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.entity.Payment;
import com.omni.payment.entity.RefundRequest;
import com.omni.payment.mapper.PaymentMapper;
import com.omni.payment.mapper.RefundRequestMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class PaymentReconciliationService {

    private static final int PAYMENT_STATUS_SUCCESS = 1;
    private static final int REFUND_STATUS_REFUNDED = 1;
    private static final BigDecimal ZERO_AMOUNT = new BigDecimal("0.00");

    private final PaymentMapper paymentMapper;
    private final RefundRequestMapper refundRequestMapper;

    public PaymentReconciliationService(PaymentMapper paymentMapper,
                                        RefundRequestMapper refundRequestMapper) {
        this.paymentMapper = paymentMapper;
        this.refundRequestMapper = refundRequestMapper;
    }

    public ReconciliationSourceResponse getLocalReconciliation(LocalDate bizDate) {
        if (bizDate == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "对账日期不能为空");
        }
        LocalDateTime start = bizDate.atStartOfDay();
        LocalDateTime end = bizDate.plusDays(1).atStartOfDay();
        List<Payment> payments = paymentMapper.selectList(new LambdaQueryWrapper<Payment>()
                .eq(Payment::getStatus, PAYMENT_STATUS_SUCCESS)
                .and(wrapper -> wrapper
                        .ge(Payment::getPayTime, start)
                        .lt(Payment::getPayTime, end)
                        .or(fallback -> fallback
                                .isNull(Payment::getPayTime)
                                .ge(Payment::getCreateTime, start)
                                .lt(Payment::getCreateTime, end)))
                .orderByAsc(Payment::getPayTime)
                .orderByAsc(Payment::getCreateTime)
                .orderByAsc(Payment::getId));
        List<RefundRequest> refunds = refundRequestMapper.selectList(new LambdaQueryWrapper<RefundRequest>()
                .eq(RefundRequest::getStatus, REFUND_STATUS_REFUNDED)
                .and(wrapper -> wrapper
                        .ge(RefundRequest::getRefundTime, start)
                        .lt(RefundRequest::getRefundTime, end)
                        .or(fallback -> fallback
                                .isNull(RefundRequest::getRefundTime)
                                .ge(RefundRequest::getCreateTime, start)
                                .lt(RefundRequest::getCreateTime, end)))
                .orderByAsc(RefundRequest::getRefundTime)
                .orderByAsc(RefundRequest::getCreateTime)
                .orderByAsc(RefundRequest::getId));

        List<ReconciliationDetailResponse> details = new ArrayList<>();
        payments.forEach(payment -> details.add(toPaymentDetail(payment)));
        refunds.forEach(refund -> details.add(toRefundDetail(refund)));

        BigDecimal paymentAmount = payments.stream()
                .map(payment -> amountOrZero(payment.getAmount()))
                .reduce(ZERO_AMOUNT, BigDecimal::add);
        BigDecimal refundAmount = refunds.stream()
                .map(refund -> amountOrZero(refund.getAmount()))
                .reduce(ZERO_AMOUNT, BigDecimal::add);

        ReconciliationSourceResponse response = new ReconciliationSourceResponse();
        response.setDetails(details);
        response.setSummaryJson(buildSummaryJson(bizDate, payments.size(), paymentAmount, refunds.size(), refundAmount));
        response.setDifferences(List.of());
        return response;
    }

    private ReconciliationDetailResponse toPaymentDetail(Payment payment) {
        BigDecimal amount = amountOrZero(payment.getAmount());
        ReconciliationDetailResponse detail = new ReconciliationDetailResponse();
        detail.setBusinessNo(StringUtils.hasText(payment.getPaymentNo())
                ? payment.getPaymentNo()
                : "PAYMENT-" + payment.getId());
        detail.setBusinessType("payment");
        detail.setExpectedAmount(amount);
        detail.setActualAmount(amount);
        detail.setStatus("matched");
        detail.setCreateTime(payment.getPayTime() != null ? payment.getPayTime() : payment.getCreateTime());
        return detail;
    }

    private ReconciliationDetailResponse toRefundDetail(RefundRequest refund) {
        BigDecimal amount = amountOrZero(refund.getAmount());
        ReconciliationDetailResponse detail = new ReconciliationDetailResponse();
        detail.setBusinessNo(StringUtils.hasText(refund.getRefundNo())
                ? refund.getRefundNo()
                : "REFUND-" + refund.getId());
        detail.setBusinessType("refund");
        detail.setExpectedAmount(amount);
        detail.setActualAmount(amount);
        detail.setStatus("matched");
        detail.setCreateTime(refund.getRefundTime() != null ? refund.getRefundTime() : refund.getCreateTime());
        return detail;
    }

    private BigDecimal amountOrZero(BigDecimal amount) {
        return (amount == null ? BigDecimal.ZERO : amount).setScale(2, RoundingMode.HALF_UP);
    }

    private String buildSummaryJson(LocalDate bizDate,
                                    int paymentCount,
                                    BigDecimal paymentAmount,
                                    int refundCount,
                                    BigDecimal refundAmount) {
        BigDecimal netAmount = paymentAmount.subtract(refundAmount).setScale(2, RoundingMode.HALF_UP);
        return "{"
                + "\"业务日期\":\"" + bizDate + "\","
                + "\"支付笔数\":" + paymentCount + ","
                + "\"支付金额\":\"" + paymentAmount.toPlainString() + "\","
                + "\"退款笔数\":" + refundCount + ","
                + "\"退款金额\":\"" + refundAmount.toPlainString() + "\","
                + "\"净额\":\"" + netAmount.toPlainString() + "\","
                + "\"差异数\":0"
                + "}";
    }
}
