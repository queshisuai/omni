package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.user.dto.HelpFaqResponse;
import com.omni.user.dto.SupportAccountRequest;
import com.omni.user.dto.SupportAccountResponse;
import com.omni.user.dto.SupportConversationRequest;
import com.omni.user.dto.SupportConversationResponse;
import com.omni.user.dto.SupportMessageRequest;
import com.omni.user.dto.SupportMessageResponse;
import com.omni.user.service.CustomerSupportService;
import com.omni.user.service.HelpCenterService;
import com.omni.user.service.SupportAccountService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user")
public class SupportController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final HelpCenterService helpCenterService;
    private final CustomerSupportService customerSupportService;
    private final SupportAccountService supportAccountService;

    public SupportController(HelpCenterService helpCenterService,
                             CustomerSupportService customerSupportService,
                             SupportAccountService supportAccountService) {
        this.helpCenterService = helpCenterService;
        this.customerSupportService = customerSupportService;
        this.supportAccountService = supportAccountService;
    }

    @GetMapping("/help/faqs")
    public Result<List<HelpFaqResponse>> listFaqs() {
        return Result.success(helpCenterService.listFaqs());
    }

    @PostMapping("/support/conversations")
    public Result<SupportConversationResponse> startConversation(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) SupportConversationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.startConversation(userId, request));
    }

    @GetMapping("/support/conversations/my")
    public Result<List<SupportConversationResponse>> listMine(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.listMine(userId));
    }

    @GetMapping("/support/conversations/{id}/messages")
    public Result<List<SupportMessageResponse>> listMessages(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.listMessages(userId, id));
    }

    @PostMapping("/support/conversations/{id}/messages")
    public Result<SupportMessageResponse> sendMessage(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody SupportMessageRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.sendMessage(userId, id, request));
    }

    @PostMapping("/support/conversations/{id}/handoff")
    public Result<SupportConversationResponse> handoff(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.handoff(userId, id));
    }

    @GetMapping("/support/agent/conversations")
    public Result<List<SupportConversationResponse>> listAgentConversations(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.listAgentConversations(userId, status));
    }

    @PostMapping("/support/agent/conversations/{id}/claim")
    public Result<SupportConversationResponse> claim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.claim(userId, id));
    }

    @PostMapping("/support/agent/conversations/{id}/close")
    public Result<SupportConversationResponse> close(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(customerSupportService.close(userId, id));
    }

    @GetMapping("/support/admin/accounts")
    public Result<List<SupportAccountResponse>> listSupportAccounts(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(supportAccountService.list(userId));
    }

    @PostMapping("/support/admin/accounts")
    public Result<SupportAccountResponse> createSupportAccount(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody SupportAccountRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(supportAccountService.create(userId, request));
    }

    @PostMapping("/support/admin/accounts/{id}/deactivate")
    public Result<SupportAccountResponse> deactivateSupportAccount(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(supportAccountService.deactivate(userId, id));
    }

    private Long parseUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            Claims claims = JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length()));
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
