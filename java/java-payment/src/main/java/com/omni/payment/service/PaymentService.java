package com.omni.payment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.entity.Payment;
import com.omni.payment.mapper.PaymentMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 支付记录服务。
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public static final int STATUS_PENDING = 0;
    public static final int STATUS_SUCCESS = 1;
    public static final int STATUS_FAILED = 2;

    private final PaymentMapper paymentMapper;

    public PaymentService(PaymentMapper paymentMapper) {
        this.paymentMapper = paymentMapper;
    }

    /**
     * 记录显式启用的本地支付确认结果。
     */
    public Payment recordLocalPaymentConfirmation(Long orderId, BigDecimal amount) {
        String paymentNo = "PAY" + LocalDateTime.now().toString().replace("-", "").replace("T", "").replace(":", "").substring(0, 14)
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        Payment payment = new Payment();
        payment.setOrderId(orderId);
        payment.setPaymentNo(paymentNo);
        payment.setPaymentMethod("LOCAL_CONFIRMATION");
        payment.setAmount(amount != null ? amount : BigDecimal.ZERO);
        payment.setStatus(STATUS_SUCCESS);
        payment.setPayTime(LocalDateTime.now());
        payment.setCallbackData("本地支付确认，自动成功");

        paymentMapper.insert(payment);
        log.info("本地支付确认记录: paymentNo={}, orderId={}, amount={}", paymentNo, orderId, amount);
        return payment;
    }

    /**
     * 支付回调（内部调用）
     */
    public void callback(Long orderId, boolean success) {
        Payment payment = new Payment();
        payment.setOrderId(orderId);
        payment.setPaymentNo("CB" + System.currentTimeMillis());
        payment.setPaymentMethod("CALLBACK");
        payment.setAmount(BigDecimal.ZERO);
        payment.setStatus(success ? STATUS_SUCCESS : STATUS_FAILED);
        payment.setPayTime(LocalDateTime.now());
        payment.setCallbackData(success ? "回调成功" : "回调失败");

        paymentMapper.insert(payment);
    }

    /**
     * 查询支付记录
     */
    public Payment getPaymentByOrderId(Long orderId) {
        LambdaQueryWrapper<Payment> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Payment::getOrderId, orderId)
               .orderByDesc(Payment::getCreateTime)
               .last("LIMIT 1");
        Payment payment = paymentMapper.selectOne(wrapper);
        if (payment == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "支付记录不存在");
        }
        return payment;
    }
}
