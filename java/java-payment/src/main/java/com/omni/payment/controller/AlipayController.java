package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.payment.dto.PagePayRequest;
import com.omni.payment.dto.PagePayResponse;
import com.omni.payment.dto.PaymentSyncDecisionResponse;
import com.omni.payment.dto.PaymentStatusResponse;
import com.omni.payment.dto.QrPayResponse;
import com.omni.payment.service.AlipayService;
import javax.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 支付宝支付接口
 */
@RestController
@RequestMapping("/api/payment/alipay")
public class AlipayController {

    private final AlipayService alipayService;
    private final String internalApiToken;

    public AlipayController(AlipayService alipayService,
                            @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.alipayService = alipayService;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/page-pay")
    public Result<PagePayResponse> pagePay(@RequestBody PagePayRequest request) {
        return Result.success(alipayService.createPagePay(request.getOrderId()));
    }

    @PostMapping("/qr-pay")
    public Result<QrPayResponse> qrPay(@RequestBody PagePayRequest request) {
        return Result.success(alipayService.createQrPay(request.getOrderId()));
    }

    @PostMapping("/notify")
    public String notify(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        request.getParameterMap().forEach((key, values) -> {
            if (values != null && values.length > 0) {
                params.put(key, values[0]);
            }
        });
        return alipayService.handleNotify(params) ? "success" : "failure";
    }

    @GetMapping("/sync/{orderId}")
    public Result<PaymentStatusResponse> sync(@PathVariable Long orderId) {
        return Result.success(alipayService.syncByOrderId(orderId));
    }

    @PostMapping("/internal/sync-order/{orderId}")
    public Result<PaymentSyncDecisionResponse> syncOrderForCancel(
            @PathVariable Long orderId,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(alipayService.syncDecisionForCancel(orderId));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
