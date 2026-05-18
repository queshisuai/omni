package com.omni.ticket.client;

import com.omni.common.result.Result;
import com.omni.ticket.dto.DirectRefundRequest;
import com.omni.ticket.dto.DirectRefundResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-payment")
public interface PaymentInternalClient {

    @PostMapping("/api/payment/refunds/internal/direct")
    Result<DirectRefundResponse> directRefund(@RequestBody DirectRefundRequest request,
                                             @RequestHeader("X-Internal-Token") String internalToken);
}
