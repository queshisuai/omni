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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.function.Supplier;

@Service
public class PaymentConfirmationService {

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
        if (PaymentService.STATUS_SUCCESS == payment.getStatus()) {
            if (!StringUtils.hasText(tradeNo) || !tradeNo.equals(payment.getTradeNo())) {
                throw new BusinessException(ResultCode.CONFLICT, "支付流水交易号不一致");
            }
            markOrderPaid(payment.getOrderId());
            return;
        }

        markOrderPaid(payment.getOrderId());

        payment.setStatus(PaymentService.STATUS_SUCCESS);
        payment.setTradeNo(tradeNo);
        payment.setBuyerId(buyerId);
        payment.setNotifyTime(LocalDateTime.now());
        payment.setRawNotify(rawNotify);
        payment.setCallbackData(callbackData);
        payment.setPayTime(LocalDateTime.now());
        paymentMapper.updateById(payment);
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
}
