package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.SubscriptionCalendarResponse;
import com.omni.ticket.dto.SubscriptionRequest;
import com.omni.ticket.dto.SubscriptionResponse;
import com.omni.ticket.service.PerformanceSubscriptionService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ticket/subscriptions")
public class SubscriptionController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final PerformanceSubscriptionService subscriptionService;

    public SubscriptionController(PerformanceSubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @PostMapping
    public Result<SubscriptionResponse> createSubscription(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) SubscriptionRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(subscriptionService.createSubscription(userId, request));
    }

    @GetMapping
    public Result<List<SubscriptionResponse>> listSubscriptions(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(subscriptionService.listSubscriptions(userId));
    }

    @DeleteMapping("/{id}")
    public Result<Void> cancelSubscription(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        subscriptionService.cancelSubscription(userId, id);
        return Result.success();
    }

    @GetMapping("/calendar")
    public Result<SubscriptionCalendarResponse> createCalendar(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(subscriptionService.createCalendar(userId));
    }

    private Long parseUserId(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) return null;
        try {
            return Long.valueOf(JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length())).getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
