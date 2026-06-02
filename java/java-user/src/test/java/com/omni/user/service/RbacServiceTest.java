package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.UserMapper;
import com.omni.user.entity.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RbacServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final RbacRolePermissionMapper rbacRolePermissionMapper = mock(RbacRolePermissionMapper.class);
    private final RbacService service = new RbacService(userMapper, rbacRolePermissionMapper);

    @Test
    void internalAuthContextIncludesRolePermissionsAndSupportRole() {
        when(userMapper.selectById(7L)).thenReturn(user(7L, "support_manager", 1));
        when(rbacRolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("support.conversation.view"),
                rolePermission("support.account.manage"),
                rolePermission("audit.view")
        ));

        InternalAuthContextResponse response = service.getInternalAuthContext(7L);

        assertEquals("support_manager", response.getRole());
        assertEquals("support_manager", response.getEffectiveRole());
        assertEquals(List.of("support.conversation.view", "support.account.manage", "audit.view"), response.getPermissionCodes());
        assertEquals("support_manager", response.getSupportRole());
    }

    private User user(Long id, String role, Integer status) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(status);
        return user;
    }

    private RbacRolePermission rolePermission(String permissionCode) {
        RbacRolePermission rp = new RbacRolePermission();
        rp.setPermissionCode(permissionCode);
        return rp;
    }
}
