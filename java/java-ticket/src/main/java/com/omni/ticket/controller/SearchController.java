package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.SearchHistoryRequest;
import com.omni.ticket.dto.SearchTrendingItem;
import com.omni.ticket.service.SearchHistoryService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final SearchHistoryService searchHistoryService;

    public SearchController(SearchHistoryService searchHistoryService) {
        this.searchHistoryService = searchHistoryService;
    }

    @GetMapping("/history")
    public Result<List<String>> getHistory(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(searchHistoryService.listHistory(userId));
    }

    @PostMapping("/history")
    public Result<List<String>> addHistory(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) SearchHistoryRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(searchHistoryService.addHistory(userId, request));
    }

    @DeleteMapping("/history")
    public Result<Void> clearHistory(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        searchHistoryService.clearHistory(userId);
        return Result.success();
    }

    @GetMapping("/trending")
    public Result<List<SearchTrendingItem>> getTrending() {
        return Result.success(searchHistoryService.listTrending());
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
