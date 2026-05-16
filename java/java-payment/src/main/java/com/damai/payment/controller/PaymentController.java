package com.damai.payment.controller;

import com.damai.common.result.Result;
import com.damai.payment.entity.Payment;
import com.damai.payment.service.PaymentService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 支付接口
 */
@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    /**
     * 模拟支付
     */
    @PostMapping("/pay")
    public Result<Payment> mockPay(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(body.get("orderId").toString());
        BigDecimal amount = body.get("amount") != null
                ? new BigDecimal(body.get("amount").toString())
                : BigDecimal.ZERO;
        Payment payment = paymentService.mockPay(orderId, amount);
        return Result.success(payment);
    }

    /**
     * 支付回调（内部）
     */
    @PostMapping("/callback")
    public Result<Void> callback(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(body.get("orderId").toString());
        boolean success = (boolean) body.getOrDefault("success", true);
        paymentService.callback(orderId, success);
        return Result.success();
    }

    /**
     * 查询支付记录
     */
    @GetMapping("/record/{orderId}")
    public Result<Payment> getPaymentRecord(@PathVariable Long orderId) {
        Payment payment = paymentService.getPaymentByOrderId(orderId);
        return Result.success(payment);
    }
}
