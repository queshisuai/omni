package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.search.ActivitySearchIndexService;
import com.omni.ticket.search.ActivitySearchRebuildResult;
import com.omni.ticket.service.UserAccessService;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivitySearchIndexControllerTest {

    private final ActivitySearchIndexService indexService = mock(ActivitySearchIndexService.class);
    private final UserAccessService userAccessService = mock(UserAccessService.class);
    private final ActivitySearchIndexController controller =
            new ActivitySearchIndexController(indexService, userAccessService);

    @Test
    void rebuildRequiresAuthorization() {
        Result<ActivitySearchRebuildResult> result = controller.rebuild(null);

        assertEquals(401, result.getCode());
        verify(indexService, never()).rebuildAll();
    }

    @Test
    void rebuildRejectsUserWithoutPermission() {
        when(userAccessService.requireAdminOrAnyPermissionRole(2004L, "activity.manage", "rbac.manage"))
                .thenReturn(null);

        Result<ActivitySearchRebuildResult> result = controller.rebuild(userToken());

        assertEquals(403, result.getCode());
        verify(indexService, never()).rebuildAll();
    }

    @Test
    void rebuildDelegatesForAdmin() {
        when(userAccessService.requireAdminOrAnyPermissionRole(2002L, "activity.manage", "rbac.manage"))
                .thenReturn("admin");
        ActivitySearchRebuildResult rebuildResult = new ActivitySearchRebuildResult();
        rebuildResult.setIndexedCount(2L);
        rebuildResult.setIndexName("omni_activity_v20260606");
        rebuildResult.setAliasName("omni_activity_current");
        rebuildResult.setStartedAt(LocalDateTime.parse("2026-06-06T20:00:00"));
        rebuildResult.setFinishedAt(LocalDateTime.parse("2026-06-06T20:00:01"));
        when(indexService.rebuildAll()).thenReturn(rebuildResult);

        Result<ActivitySearchRebuildResult> result = controller.rebuild(adminToken());

        assertEquals(200, result.getCode());
        assertEquals(2L, result.getData().getIndexedCount());
        verify(indexService).rebuildAll();
    }

    @Test
    void rebuildChecksExpectedPermissions() {
        when(userAccessService.requireAdminOrAnyPermissionRole(2002L, "activity.manage", "rbac.manage"))
                .thenReturn("admin");
        when(indexService.rebuildAll()).thenReturn(new ActivitySearchRebuildResult());

        controller.rebuild(adminToken());

        verify(userAccessService).requireAdminOrAnyPermissionRole(2002L, "activity.manage", "rbac.manage");
        verify(userAccessService, never()).requireAdminOrOrganizerOrAnyPermissionRole(anyLong(), eq("activity.manage"));
    }

    private String adminToken() {
        return "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin");
    }

    private String userToken() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13900000001", "user");
    }
}
