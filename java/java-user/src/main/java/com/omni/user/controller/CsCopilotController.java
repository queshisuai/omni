package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.CsCopilotEditRequest;
import com.omni.user.dto.CsCopilotRejectRequest;
import com.omni.user.dto.CsCopilotSuggestionResponse;
import com.omni.user.service.SupportCopilotService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/user/cs")
public class CsCopilotController {
    private static final String BEARER_PREFIX = "Bearer ";
    private final SupportCopilotService copilotService;

    public CsCopilotController(SupportCopilotService copilotService) {
        this.copilotService = copilotService;
    }

    @PostMapping("/sessions/{sessionId}/copilot/suggestions")
    public Result<CsCopilotSuggestionResponse> generate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId,
            HttpServletResponse response) {
        Long actor = parseUserId(authorization);
        if (actor == null) return fail(response, ResultCode.UNAUTHORIZED);
        try {
            return Result.success(copilotService.generate(actor, sessionId));
        } catch (BusinessException e) {
            return fail(response, e.getCode(), e.getMessage());
        }
    }

    @PostMapping("/copilot/suggestions/{suggestionId}/accept")
    public Result<CsCopilotSuggestionResponse> accept(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long suggestionId,
            HttpServletResponse response) {
        Long actor = parseUserId(authorization);
        if (actor == null) return fail(response, ResultCode.UNAUTHORIZED);
        try {
            return Result.success(copilotService.accept(actor, suggestionId));
        } catch (BusinessException e) {
            return fail(response, e.getCode(), e.getMessage());
        }
    }

    @PostMapping("/copilot/suggestions/{suggestionId}/edit")
    public Result<CsCopilotSuggestionResponse> edit(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long suggestionId,
            @RequestBody(required = false) CsCopilotEditRequest request,
            HttpServletResponse response) {
        Long actor = parseUserId(authorization);
        if (actor == null) return fail(response, ResultCode.UNAUTHORIZED);
        try {
            return Result.success(copilotService.edit(actor, suggestionId, request));
        } catch (BusinessException e) {
            return fail(response, e.getCode(), e.getMessage());
        }
    }

    @PostMapping("/copilot/suggestions/{suggestionId}/reject")
    public Result<CsCopilotSuggestionResponse> reject(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long suggestionId,
            @RequestBody(required = false) CsCopilotRejectRequest request,
            HttpServletResponse response) {
        Long actor = parseUserId(authorization);
        if (actor == null) return fail(response, ResultCode.UNAUTHORIZED);
        try {
            return Result.success(copilotService.reject(actor, suggestionId, request));
        } catch (BusinessException e) {
            return fail(response, e.getCode(), e.getMessage());
        }
    }

    private <T> Result<T> fail(HttpServletResponse response, ResultCode code) {
        return fail(response, code.getCode(), code.getMessage());
    }

    private <T> Result<T> fail(HttpServletResponse response, int code, String message) {
        if (response != null && code >= 100 && code <= 599) response.setStatus(code);
        return Result.fail(code, message);
    }

    private Long parseUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) return null;
        try {
            Claims claims = JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length()));
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
