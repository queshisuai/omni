package com.omni.payment.service;

import com.alibaba.csp.sentinel.Entry;
import com.alibaba.csp.sentinel.SphU;
import com.alibaba.csp.sentinel.Tracer;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.config.PaymentSentinelConfig;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.mapper.PaymentMapper;
import io.seata.spring.annotation.GlobalTransactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.function.Supplier;

@Service
public class PaymentConfirmationService {

    private static final Logger log = LoggerFactory.getLogger(PaymentConfirmationService.class);

    private final OrderClient orderClient;
    private final PaymentMapper paymentMapper;
    private final String internalApiToken;

    public PaymentConfirmationService(OrderClient orderClient,
                                      PaymentMapper paymentMapper,
                                      @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderClient = orderClient;
        this.paymentMapper = paymentMapper;
        this.internalApiToken = internalApiToken;
    }

    @GlobalTransactional(name = "omni-confirm-payment", rollbackFor = Exception.class)
    public void confirmPayment(Payment payment, String tradeNo, String buyerId, String rawNotify, String callbackData) {
        PaymentConfirmationLatencyTrace latencyTrace = new PaymentConfirmationLatencyTrace(payment);
        String outcome = "FAILED";
        if (PaymentService.STATUS_SUCCESS == payment.getStatus()) {
            if (!StringUtils.hasText(tradeNo) || !tradeNo.equals(payment.getTradeNo())) {
                throw new BusinessException(ResultCode.CONFLICT, "支付流水交易号不一致");
            }
            try {
                latencyTrace.measureOrderMarkPaid(() -> markOrderPaid(payment.getOrderId()));
                outcome = "IDEMPOTENT_CONFIRMED";
                return;
            } finally {
                latencyTrace.log(outcome);
            }
        }

        try {
            latencyTrace.measureOrderMarkPaid(() -> markOrderPaid(payment.getOrderId()));

            payment.setStatus(PaymentService.STATUS_SUCCESS);
            payment.setTradeNo(tradeNo);
            payment.setBuyerId(buyerId);
            payment.setNotifyTime(LocalDateTime.now());
            payment.setRawNotify(rawNotify);
            payment.setCallbackData(callbackData);
            payment.setPayTime(LocalDateTime.now());
            latencyTrace.measurePaymentUpdate(() -> paymentMapper.updateById(payment));
            outcome = "CONFIRMED";
        } finally {
            latencyTrace.log(outcome);
        }
    }

    public void confirmLocalPaymentConfirmation(Payment payment) {
        if (payment == null || payment.getOrderId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "支付记录无效");
        }
        markOrderPaid(payment.getOrderId());
    }

    private void markOrderPaid(Long orderId) {
        String token = requireInternalApiToken();
        Result<OrderInfoResponse> result = callOrderClient(() -> orderClient.markPaid(orderId, token));
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "更新订单支付状态失败");
        }
    }

    private <T> T callOrderClient(Supplier<T> call) {
        Entry entry = null;
        try {
            entry = SphU.entry(PaymentSentinelConfig.ORDER_CLIENT);
            return call.get();
        } catch (BlockException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "订单服务暂不可用，请稍后重试");
        } catch (RuntimeException e) {
            Tracer.traceEntry(e, entry);
            throw e;
        } finally {
            if (entry != null) {
                entry.exit();
            }
        }
    }

    private String requireInternalApiToken() {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        return internalApiToken;
    }

    private static final class PaymentConfirmationLatencyTrace {
        private final Long paymentId;
        private final Long orderId;
        private final long startedAtNanos = System.nanoTime();
        private long orderMarkPaidNanos;
        private long paymentUpdateNanos;

        private PaymentConfirmationLatencyTrace(Payment payment) {
            this.paymentId = payment != null ? payment.getId() : null;
            this.orderId = payment != null ? payment.getOrderId() : null;
        }

        private void measureOrderMarkPaid(Runnable action) {
            long startedAt = System.nanoTime();
            try {
                action.run();
            } finally {
                orderMarkPaidNanos += Math.max(0L, System.nanoTime() - startedAt);
            }
        }

        private void measurePaymentUpdate(Runnable action) {
            long startedAt = System.nanoTime();
            try {
                action.run();
            } finally {
                paymentUpdateNanos += Math.max(0L, System.nanoTime() - startedAt);
            }
        }

        private void log(String outcome) {
            long totalNanos = Math.max(0L, System.nanoTime() - startedAtNanos);
            PaymentConfirmationService.log.info(
                    "支付确认链路耗时: paymentId={} orderId={} outcome={} orderMarkPaidMs={} paymentUpdateMs={} totalMs={}",
                    paymentId,
                    orderId,
                    outcome,
                    millis(orderMarkPaidNanos),
                    millis(paymentUpdateNanos),
                    millis(totalNanos)
            );
        }

        private long millis(long nanos) {
            return nanos / 1_000_000L;
        }
    }
}
