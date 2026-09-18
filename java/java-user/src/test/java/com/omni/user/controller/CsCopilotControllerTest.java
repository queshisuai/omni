package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.CsCopilotSuggestionResponse;
import com.omni.user.service.SupportCopilotService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CsCopilotControllerTest {
    private final SupportCopilotService service = mock(SupportCopilotService.class);
    private final CsCopilotController controller = new CsCopilotController(service);

    @Test
    void rejectsUnauthenticatedCopilotRequest() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        Result<?> result = controller.generate(null, 10L, response);

        assertEquals(401, result.getCode());
        verifyNoInteractions(service);
    }

    @Test
    void authenticatedGenerateUsesLockedCopilotPath() {
        when(service.generate(eq(7L), eq(10L))).thenReturn(new CsCopilotSuggestionResponse());

        Result<CsCopilotSuggestionResponse> result = controller.generate(
                "Bearer " + JwtUtil.generateToken(7L, "13800000000", "support"),
                10L, new MockHttpServletResponse());

        assertEquals(200, result.getCode());
        verify(service).generate(7L, 10L);
    }

    @Test
    void returnsForbiddenForAuthenticatedUserRejectedByRbac() {
        when(service.generate(7L, 10L))
                .thenThrow(new BusinessException(ResultCode.FORBIDDEN, "无权限"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        Result<?> result = controller.generate(
                "Bearer " + JwtUtil.generateToken(7L, "13800000000", "user"),
                10L, response);

        assertEquals(403, result.getCode());
        assertEquals(403, response.getStatus());
        verify(service).generate(7L, 10L);
    }

    @Test
    void returnsConflictWithoutDraftForStaleAccept() {
        when(service.accept(7L, 900L))
                .thenThrow(new BusinessException(ResultCode.CONFLICT, "AI 建议已过期"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        Result<CsCopilotSuggestionResponse> result = controller.accept(
                "Bearer " + JwtUtil.generateToken(7L, "13800000000", "support"),
                900L, response);

        assertEquals(409, result.getCode());
        assertEquals(409, response.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(result.getData());
    }
}
