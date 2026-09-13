package com.omni.user.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.user.dto.CsSessionQuery;
import com.omni.user.dto.CsSessionResponse;
import com.omni.user.dto.CsUserSessionHistoryResponse;
import com.omni.user.service.CsSessionService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import java.util.List;

class CsControllerTest {

    private final CsSessionService service = mock(CsSessionService.class);
    private final CsController controller = new CsController(service);

    @Test
    void rejectsMissingAuthorizationHeader() {
        Result<?> result = controller.getOrgTree(null);

        assertEquals(401, result.getCode());
    }

    @Test
    void passesAuthenticatedUserIdToService() {
        Page<CsSessionResponse> page = new Page<>(1, 30);
        when(service.listSessions(eq(7L), org.mockito.ArgumentMatchers.any(CsSessionQuery.class))).thenReturn(page);

        Result<Page<CsSessionResponse>> result = controller.listSessions(
                "Bearer " + JwtUtil.generateToken(7L, "13800000000", "support"),
                null, null, "ACTIVE", false, null, 1, 30, "latest", null, null);

        assertEquals(200, result.getCode());
        verify(service).listSessions(eq(7L), org.mockito.ArgumentMatchers.any(CsSessionQuery.class));
    }

    @Test
    void historyRoutePassesActorAndUserIdsToService() {
        when(service.listUserSessionHistory(7L, 99L)).thenReturn(List.of(new CsUserSessionHistoryResponse()));

        Result<List<CsUserSessionHistoryResponse>> result = controller.listUserSessionHistory(
                "Bearer " + JwtUtil.generateToken(7L, "13800000000", "support"), 99L);

        assertEquals(200, result.getCode());
        verify(service).listUserSessionHistory(eq(7L), eq(99L));
    }
}
