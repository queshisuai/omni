package com.omni.user.controller;

import com.omni.user.config.UserSentinelConfig;
import com.omni.user.dto.LoginRequest;
import com.omni.user.service.OrganizerApplicationService;
import com.omni.user.service.UserService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class UserControllerSentinelTest {

    private final UserService userService = mock(UserService.class);
    private final OrganizerApplicationService organizerApplicationService = mock(OrganizerApplicationService.class);
    private final UserController controller = new UserController(userService, organizerApplicationService, "internal-token");

    @Test
    void loginBlockHandlerReturnsBusyWithoutCallingService() throws NoSuchMethodException {
        LoginRequest request = new LoginRequest();

        var result = controller.loginBlocked(request, null);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verify(userService, never()).login(request);
        assertEquals(UserSentinelConfig.LOGIN_PASSWORD, UserController.class
                .getMethod("login", LoginRequest.class)
                .getAnnotation(com.alibaba.csp.sentinel.annotation.SentinelResource.class)
                .value());
    }

    @Test
    void sendCodeBlockHandlerReturnsBusyWithoutRunningSendCode() throws NoSuchMethodException {
        var result = controller.sendCodeBlocked("13900000001", null);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        assertEquals(UserSentinelConfig.SEND_CODE, UserController.class
                .getMethod("sendCode", String.class)
                .getAnnotation(com.alibaba.csp.sentinel.annotation.SentinelResource.class)
                .value());
    }
}
