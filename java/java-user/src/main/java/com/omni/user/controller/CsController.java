package com.omni.user.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.user.dto.CsAuditRequest;
import com.omni.user.dto.CsInternalNoteRequest;
import com.omni.user.dto.CsOrgTreeResponse;
import com.omni.user.dto.CsSessionMessageResponse;
import com.omni.user.dto.CsSessionQuery;
import com.omni.user.dto.CsSessionResponse;
import com.omni.user.dto.CsTransferRequest;
import com.omni.user.dto.CsUserSessionHistoryResponse;
import com.omni.user.service.CsSessionService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user/cs")
public class CsController {

    private static final String BEARER_PREFIX = "Bearer ";
    private final CsSessionService csSessionService;

    public CsController(CsSessionService csSessionService) {
        this.csSessionService = csSessionService;
    }

    @GetMapping("/org-tree")
    public Result<CsOrgTreeResponse> getOrgTree(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.getOrgTree(actorUserId));
    }

    @GetMapping("/sessions")
    public Result<Page<CsSessionResponse>> listSessions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long agentId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean slaTimeoutOnly,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Boolean unassignedOnly,
            @RequestParam(required = false) String sourceType) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        CsSessionQuery query = new CsSessionQuery();
        query.setGroupId(groupId);
        query.setAgentId(agentId);
        query.setStatus(status);
        query.setSlaTimeoutOnly(slaTimeoutOnly);
        query.setKeyword(keyword);
        query.setPage(page);
        query.setSize(size);
        query.setSort(sort);
        query.setUnassignedOnly(unassignedOnly);
        query.setSourceType(sourceType);
        return Result.success(csSessionService.listSessions(actorUserId, query));
    }

    @GetMapping("/sessions/{id}/messages")
    public Result<List<CsSessionMessageResponse>> listMessages(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.listMessages(actorUserId, id));
    }

    @GetMapping("/users/{userId}/sessions-history")
    public Result<List<CsUserSessionHistoryResponse>> listUserSessionHistory(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long userId) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.listUserSessionHistory(actorUserId, userId));
    }

    @PostMapping("/sessions/{id}/claim")
    public Result<CsSessionResponse> claim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.claim(actorUserId, id));
    }

    @PostMapping("/sessions/{id}/transfer")
    public Result<CsSessionResponse> transfer(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) CsTransferRequest request) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.transfer(actorUserId, id, request));
    }

    @PostMapping("/sessions/{id}/escalate")
    public Result<CsSessionResponse> escalate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> request) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        String reason = request == null ? null : request.get("reason");
        return Result.success(csSessionService.escalate(actorUserId, id, reason));
    }

    @PostMapping("/sessions/{id}/audit")
    public Result<CsSessionResponse> audit(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) CsAuditRequest request) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.audit(actorUserId, id, request));
    }

    @PostMapping("/sessions/{id}/internal-note")
    public Result<CsInternalNoteRequest> addInternalNote(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) CsInternalNoteRequest request) {
        Long actorUserId = parseUserId(authorization);
        if (actorUserId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(csSessionService.addInternalNote(actorUserId, id, request));
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
