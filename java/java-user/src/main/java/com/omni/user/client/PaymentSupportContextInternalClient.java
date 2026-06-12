package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.SupportContextResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(contextId = "paymentSupportContextInternalClient", name = "java-payment", url = "${omni.payment-service.url:}")
public interface PaymentSupportContextInternalClient {

    @GetMapping("/api/payment/refunds/internal/users/{userId}")
    Result<List<SupportContextResponse.SupportContextRefund>> listRefunds(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);
}
