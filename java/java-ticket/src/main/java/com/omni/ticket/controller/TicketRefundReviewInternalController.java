package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.TicketRefundReviewPermissionResponse;
import com.omni.ticket.service.TicketRefundReviewInternalService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ticket/internal/refund-review")
public class TicketRefundReviewInternalController {
    private final TicketRefundReviewInternalService service;
    private final String internalApiToken;

    public TicketRefundReviewInternalController(TicketRefundReviewInternalService service,
                                                @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.service = service;
        this.internalApiToken = internalApiToken;
    }

    @GetMapping("/permission")
    public Result<TicketRefundReviewPermissionResponse> checkPermission(
            @RequestParam("sessionId") Long sessionId,
            @RequestParam("reviewerId") Long reviewerId,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(service.checkPermission(sessionId, reviewerId));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
