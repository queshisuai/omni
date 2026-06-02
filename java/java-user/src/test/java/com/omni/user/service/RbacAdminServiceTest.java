package com.omni.user.service;

import com.omni.user.entity.RbacPermission;
import com.omni.user.entity.RbacRole;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRoleMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RbacAdminServiceTest {
    private final RbacRoleMapper roleMapper = mock(RbacRoleMapper.class);
    private final RbacPermissionMapper permissionMapper = mock(RbacPermissionMapper.class);
    private final RbacRolePermissionMapper rolePermissionMapper = mock(RbacRolePermissionMapper.class);
    private final RbacAdminService service = new RbacAdminService(roleMapper, permissionMapper, rolePermissionMapper);

    @Test
    void listsRolesWithAssignedPermissionCodes() {
        RbacRole role = new RbacRole();
        role.setCode("support_manager");
        role.setName("客服主管");
        RbacPermission permission = new RbacPermission();
        permission.setCode("support.account.manage");
        permission.setName("客服账号管理");
        RbacRolePermission rolePermission = new RbacRolePermission();
        rolePermission.setRoleCode("support_manager");
        rolePermission.setPermissionCode("support.account.manage");
        when(roleMapper.selectList(any())).thenReturn(List.of(role));
        when(permissionMapper.selectList(any())).thenReturn(List.of(permission));
        when(rolePermissionMapper.selectList(any())).thenReturn(List.of(rolePermission));

        List<com.omni.user.dto.RbacRoleResponse> roles = service.listRoles();

        assertEquals(1, roles.size());
        assertEquals("support_manager", roles.get(0).getCode());
        assertEquals(List.of("support.account.manage"), roles.get(0).getPermissionCodes());
    }

    @Test
    void replacesRolePermissions() {
        RbacRole role = new RbacRole();
        role.setCode("support_manager");
        RbacPermission conversationPermission = new RbacPermission();
        conversationPermission.setCode("support.conversation.view");
        RbacPermission accountPermission = new RbacPermission();
        accountPermission.setCode("support.account.manage");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(permissionMapper.selectList(any())).thenReturn(List.of(conversationPermission, accountPermission));

        service.updateRolePermissions("support_manager", List.of("support.conversation.view", "support.account.manage"));

        verify(rolePermissionMapper).delete(any());
        verify(rolePermissionMapper, times(2)).insert(any(RbacRolePermission.class));
    }

    @Test
    void rejectsUnknownPermissionCode() {
        RbacRole role = new RbacRole();
        role.setCode("support_manager");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(permissionMapper.selectList(any())).thenReturn(List.of());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateRolePermissions("support_manager", List.of("missing.permission")));

        assertEquals("权限不存在：missing.permission", error.getMessage());
    }

    @Test
    void rejectsRemovingLastRbacManagePermission() {
        RbacRole role = new RbacRole();
        role.setCode("platform_super_admin");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(permissionMapper.selectList(any())).thenReturn(List.of());
        when(rolePermissionMapper.selectCount(any()))
                .thenReturn(1L)
                .thenReturn(1L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateRolePermissions("platform_super_admin", List.of()));

        assertEquals("至少保留一个拥有角色权限管理的角色", error.getMessage());
    }
}
