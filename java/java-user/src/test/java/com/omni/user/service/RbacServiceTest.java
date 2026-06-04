package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.SupportAccountMapper;
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
    private final SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
    private final RbacRolePermissionMapper rbacRolePermissionMapper = mock(RbacRolePermissionMapper.class);
    private final RbacService service = new RbacService(userMapper, supportAccountMapper, rbacRolePermissionMapper);

    @Test
    void internalAuthContextIncludesRolePermissionsAndSupportRole() {
        when(userMapper.selectById(7L)).thenReturn(user(7L, "support", 1));
        when(supportAccountMapper.selectById(7L)).thenReturn(supportAccount(7L, "support_manager"));
        when(rbacRolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("support.conversation.view"),
                rolePermission("support.account.manage"),
                rolePermission("audit.view")
        ));

        InternalAuthContextResponse response = service.getInternalAuthContext(7L);

        assertEquals("support", response.getRole());
        assertEquals("support_manager", response.getEffectiveRole());
        assertEquals(List.of("support.conversation.view", "support.account.manage", "audit.view"), response.getPermissionCodes());
        assertEquals("support_manager", response.getSupportRole());
    }

    @Test
    void organizerUserKeepsOrganizerRoleForOwnBusinessScope() {
        when(userMapper.selectById(9L)).thenReturn(user(9L, "organizer", 1));
        when(rbacRolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("activity.manage"),
                rolePermission("order.view")
        ));

        InternalAuthContextResponse response = service.getInternalAuthContext(9L);

        assertEquals("organizer", response.getRole());
        assertEquals("organizer", response.getEffectiveRole());
        assertEquals("organizer", response.getScopeType());
        assertEquals(9L, response.getScopeId());
        assertEquals(List.of("activity.manage", "order.view"), response.getPermissionCodes());
    }

    @Test
    void organizerAdminIncludesOrganizerConsolePermissions() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "organizer_admin", 1));
        List<String> permissions = List.of(
                "activity.manage",
                "tour.manage",
                "session.manage",
                "artist.manage",
                "order.view",
                "refund.review",
                "venue.manage",
                "organizer.review",
                "organizer.account.manage",
                "venue.review",
                "audit.view"
        );
        when(rbacRolePermissionMapper.selectList(any())).thenReturn(
                permissions.stream().map(this::rolePermission).collect(java.util.stream.Collectors.toList())
        );

        InternalAuthContextResponse response = service.getInternalAuthContext(10L);

        assertEquals("organizer_admin", response.getRole());
        assertEquals("organizer_admin", response.getEffectiveRole());
        assertEquals("platform", response.getScopeType());
        assertEquals(null, response.getScopeId());
        assertEquals(permissions, response.getPermissionCodes());
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

    private SupportAccount supportAccount(Long userId, String supportRole) {
        SupportAccount account = new SupportAccount();
        account.setUserId(userId);
        account.setSupportRole(supportRole);
        account.setStatus(1);
        return account;
    }
}
