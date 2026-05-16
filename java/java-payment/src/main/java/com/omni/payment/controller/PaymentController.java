package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.payment.entity.Payment;
import com.omni.payment.service.PaymentService;
import org.springframework.web.bind.annotation.*;

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
     * 旧模拟支付接口已禁用，避免污染支付宝支付流水。
     */
    @PostMapping("/pay")
    public Result<Void> mockPay(@RequestBody Map<String, Object> body) {
        return Result.fail(400, "请通过支付宝支付");
    }

    /**
     * 支付回调（内部）
     */
    @PostMapping("/callback")
    public Result<Void> callback(@RequestBody Map<String, Object> body) {
        return Result.fail(400, "请通过支付宝支付");
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
