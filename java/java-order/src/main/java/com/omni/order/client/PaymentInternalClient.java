package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.PaymentSyncDecisionResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-payment")
public interface PaymentInternalClient {

    @PostMapping("/api/payment/alipay/internal/sync-order/{orderId}")
    Result<PaymentSyncDecisionResponse> syncOrderForCancel(
            @PathVariable("orderId") Long orderId,
            @RequestHeader("X-Internal-Token") String internalToken);
}

@Configuration
@EnableFeignClients(clients = PaymentInternalClient.class)
class PaymentInternalClientConfiguration {
}
