package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.payment.dto.MockPayRequest;
import com.omni.payment.dto.MockPayResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.service.MockPaymentService;
import com.omni.payment.service.PaymentService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final PaymentService paymentService;
    private final MockPaymentService mockPaymentService;

    public PaymentController(PaymentService paymentService, MockPaymentService mockPaymentService) {
        this.paymentService = paymentService;
        this.mockPaymentService = mockPaymentService;
    }

    @PostMapping("/pay")
    public Result<Void> mockPay(@RequestBody Map<String, Object> body) {
        return Result.fail(400, "请使用正式支付或演示模拟支付接口");
    }

    @PostMapping("/mock/pay")
    public Result<MockPayResponse> mockPayForDemo(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) MockPayRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "支付参数不能为空");
        }
        Long userId = requireAuthUserId(authorization);
        return Result.success(mockPaymentService.pay(request.getOrderId(), userId));
    }

    @PostMapping("/callback")
    public Result<Void> callback(@RequestBody Map<String, Object> body) {
        return Result.fail(400, "请使用正式支付回调接口");
    }

    @GetMapping("/record/{orderId}")
    public Result<Payment> getPaymentRecord(@PathVariable Long orderId) {
        Payment payment = paymentService.getPaymentByOrderId(orderId);
        return Result.success(payment);
    }

    private Long requireAuthUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "请先登录");
        }
        String token = authorization.substring(BEARER_PREFIX.length());
        try {
            Claims claims = JwtUtil.parseToken(token);
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "请先登录");
        }
    }
}
