package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.UserInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserAccessServiceTest {

    private final UserInternalClient userInternalClient = mock(UserInternalClient.class);

    @Test
    void requireAdminOrOrganizerReturnsOrganizer() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2003L, "internal-token")).thenReturn(Result.success(user("organizer")));

        InternalUserRefResponse response = service.requireAdminOrOrganizer(2003L);

        assertEquals("organizer", response.getRole());
    }

    @Test
    void requireAdminRejectsOrganizer() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2003L, "internal-token")).thenReturn(Result.success(user("organizer")));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireAdmin(2003L));

        assertEquals("仅平台管理员可操作", exception.getMessage());
    }

    @Test
    void requireAdminOrOrganizerRejectsNormalUser() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2004L, "internal-token")).thenReturn(Result.success(user("user")));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireAdminOrOrganizer(2004L));

        assertEquals("无权限", exception.getMessage());
    }

    @Test
    void requireUserRejectsEmptyInternalToken() {
        UserAccessService service = new UserAccessService(userInternalClient, "");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireUser(2004L));

        assertEquals("内部接口令牌未配置", exception.getMessage());
    }

    @Test
    void requireUserRejectsUserServiceFailure() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2004L, "internal-token")).thenReturn(Result.fail(500, "error"));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireUser(2004L));

        assertEquals("用户服务无响应", exception.getMessage());
    }

    private InternalUserRefResponse user(String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2003L);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }
}
