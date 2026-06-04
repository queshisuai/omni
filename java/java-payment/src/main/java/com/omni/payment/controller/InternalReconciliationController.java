package com.omni.payment.controller;

import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.common.result.Result;
import com.omni.payment.service.PaymentReconciliationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/payment/internal/reconciliation")
public class InternalReconciliationController {

    private final PaymentReconciliationService paymentReconciliationService;
    private final String internalApiToken;

    public InternalReconciliationController(PaymentReconciliationService paymentReconciliationService,
                                            @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.paymentReconciliationService = paymentReconciliationService;
        this.internalApiToken = internalApiToken;
    }

    @GetMapping("/local")
    public Result<ReconciliationSourceResponse> getLocalReconciliation(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestParam("bizDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bizDate) {
        if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(paymentReconciliationService.getLocalReconciliation(bizDate));
    }
}
