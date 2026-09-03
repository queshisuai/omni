package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.search.ActivitySearchIndexService;
import com.omni.ticket.search.ActivitySearchRebuildResult;
import com.omni.ticket.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnProperty(prefix = "omni.search", name = "provider", havingValue = "elasticsearch")
@RequestMapping("/api/ticket/admin/search-index")
public class ActivitySearchIndexController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ActivitySearchIndexService indexService;
    private final UserAccessService userAccessService;

    @Autowired
    public ActivitySearchIndexController(ActivitySearchIndexService indexService, UserAccessService userAccessService) {
        this.indexService = indexService;
        this.userAccessService = userAccessService;
    }

    @PostMapping("/rebuild")
    public Result<ActivitySearchRebuildResult> rebuild(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = parseOperatorId(authorization);
        if (operatorId == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }
        String role = userAccessService.requireAdminOrAnyPermissionRole(operatorId, "activity.manage", "rbac.manage");
        if (role == null) {
            return Result.fail(ResultCode.FORBIDDEN);
        }
        return Result.success(indexService.rebuildAll());
    }

    private Long parseOperatorId(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            return Long.valueOf(JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length())).getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
