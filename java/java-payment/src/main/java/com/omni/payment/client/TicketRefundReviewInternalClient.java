package com.omni.payment.client;

import com.omni.common.result.Result;
import com.omni.payment.dto.TicketRefundReviewPermissionResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "java-ticket")
public interface TicketRefundReviewInternalClient {

    @GetMapping("/api/ticket/internal/refund-review/permission")
    Result<TicketRefundReviewPermissionResponse> checkPermission(
            @RequestParam("sessionId") Long sessionId,
            @RequestParam("reviewerId") Long reviewerId,
            @RequestHeader("X-Internal-Token") String internalToken);
}
