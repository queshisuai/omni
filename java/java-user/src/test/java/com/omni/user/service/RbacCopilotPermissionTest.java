package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.exception.BusinessException;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.entity.UserPermissionOverride;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import com.omni.user.mapper.UserPermissionOverrideMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RbacCopilotPermissionTest {
    @Test
    void permissionCheckUsesEffectiveRbacPermissions() {
        UserMapper users = mock(UserMapper.class);
        SupportAccountMapper accounts = mock(SupportAccountMapper.class);
        RbacRolePermissionMapper rolePermissions = mock(RbacRolePermissionMapper.class);
        UserPermissionOverrideMapper overrides = mock(UserPermissionOverrideMapper.class);
        RbacPermissionMapper permissions = mock(RbacPermissionMapper.class);
        when(users.selectById(7L)).thenReturn(user());
        when(accounts.selectById(7L)).thenReturn(account());
        when(rolePermissions.selectList(any())).thenReturn(List.of(permission("support.ai.review")));
        when(overrides.selectList(any())).thenReturn(List.of());

        RbacService service = new RbacService(users, accounts, permissions, rolePermissions, overrides);

        service.requireAnyPermission(7L, "support.ai.use", "support.ai.review");
        assertThrows(BusinessException.class,
                () -> service.requireAnyPermission(7L, "support.ai.use"));
    }

    private static User user() {
        User user = new User();
        user.setId(7L);
        user.setRole("support");
        user.setStatus(1);
        return user;
    }

    private static SupportAccount account() {
        SupportAccount account = new SupportAccount();
        account.setUserId(7L);
        account.setSupportRole("support_agent");
        account.setStatus(1);
        return account;
    }

    private static RbacRolePermission permission(String code) {
        RbacRolePermission permission = new RbacRolePermission();
        permission.setPermissionCode(code);
        return permission;
    }
}
