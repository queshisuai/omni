package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.search.ActivitySearchIndexService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ticket/internal/search-index")
public class SearchIndexInternalController {
    private final ActivitySearchIndexService indexService;
    private final String internalApiToken;

    public SearchIndexInternalController(ActivitySearchIndexService indexService,
                                         @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.indexService = indexService;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/rebuild")
    public Result<Map<String, Object>> rebuild(
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        indexService.ensureIndex();
        int indexedCount = indexService.rebuildAll();
        return Result.success(Map.of("indexedCount", indexedCount));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
