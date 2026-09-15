package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.ai.FinderQueryRequest;
import com.omni.ticket.ai.FinderResponse;
import com.omni.ticket.service.AiTicketFinderService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ticket/ai/finder")
public class AiTicketFinderController {
    private static final String BEARER_PREFIX = "Bearer ";
    private final AiTicketFinderService finderService;

    public AiTicketFinderController(AiTicketFinderService finderService) {
        this.finderService = finderService;
    }

    @PostMapping("/interpret")
    public Result<FinderResponse> interpret(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) FinderQueryRequest request) {
        if (parseUserId(authorization) == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }
        if (request == null) {
            return Result.fail(ResultCode.BAD_REQUEST, "找票内容不能为空");
        }
        return Result.success(finderService.interpret(request.getQuery()));
    }

    @PostMapping("/search")
    public Result<FinderResponse> search(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) FinderQueryRequest request) {
        if (parseUserId(authorization) == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }
        if (request == null) {
            return Result.fail(ResultCode.BAD_REQUEST, "找票内容不能为空");
        }
        return Result.success(finderService.search(request.getQuery()));
    }

    private Long parseUserId(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            return Long.valueOf(JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length())).getSubject());
        } catch (RuntimeException exception) {
            return null;
        }
    }
}
