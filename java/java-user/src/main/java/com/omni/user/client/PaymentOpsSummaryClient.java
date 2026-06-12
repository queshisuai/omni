package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(contextId = "paymentOpsSummaryClient", name = "java-payment", url = "${omni.payment-service.url:}")
public interface PaymentOpsSummaryClient {

    @GetMapping("/api/payment/refunds/admin")
    Result<List<PlatformOpsSummaryResponse.RefundRequestItem>> listAdminRefunds(
            @RequestHeader("Authorization") String authorization,
            @RequestParam(value = "status", required = false) Integer status);
}
