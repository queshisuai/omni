package com.omni.user.client;

import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDate;

@FeignClient(name = "java-payment")
public interface PaymentReconciliationInternalClient {

    @GetMapping("/api/payment/internal/reconciliation/local")
    Result<ReconciliationSourceResponse> getLocalReconciliation(
            @RequestParam("bizDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bizDate,
            @RequestHeader("X-Internal-Token") String internalToken);
}
