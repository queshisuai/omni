package com.omni.user.service;

import com.omni.user.entity.RbacPermission;
import com.omni.user.entity.RbacRole;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRoleMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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
    void returnsPermissionDiffForAuditSummary() {
        RbacRole role = new RbacRole();
        role.setCode("support_manager");
        RbacPermission accountPermission = permission("support.account.manage", "客服账号管理");
        RbacPermission auditPermission = permission("audit.view", "操作审计");
        RbacPermission conversationPermission = permission("support.conversation.view", "客服会话查看");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(permissionMapper.selectList(any())).thenReturn(List.of(accountPermission, auditPermission, conversationPermission));
        when(rolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("support_manager", "audit.view"),
                rolePermission("support_manager", "support.conversation.view")
        ));

        RbacAdminService.RolePermissionUpdateResult result =
                service.updateRolePermissions("support_manager", List.of("support.conversation.view", "support.account.manage"));

        assertEquals(List.of("support.account.manage"), result.getAddedPermissionCodes());
        assertEquals(List.of("audit.view"), result.getRemovedPermissionCodes());
        assertEquals("新增权限：客服账号管理（support.account.manage）；移除权限：操作审计（audit.view）；更新后权限数：2",
                result.toAuditSummary());
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
    void platformSuperAdminAlwaysSavesEveryPermissionCode() {
        RbacRole role = new RbacRole();
        role.setCode("platform_super_admin");
        RbacPermission rbacManage = new RbacPermission();
        rbacManage.setCode("rbac.manage");
        RbacPermission stationReview = new RbacPermission();
        stationReview.setCode("station.review");
        RbacPermission organizerReview = new RbacPermission();
        organizerReview.setCode("organizer.review");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(permissionMapper.selectList(any())).thenReturn(List.of(rbacManage, stationReview, organizerReview));

        service.updateRolePermissions("platform_super_admin", List.of("rbac.manage"));

        ArgumentCaptor<RbacRolePermission> captor = ArgumentCaptor.forClass(RbacRolePermission.class);
        verify(rolePermissionMapper).delete(any());
        verify(rolePermissionMapper, times(3)).insert(captor.capture());
        assertEquals(
                List.of("rbac.manage", "station.review", "organizer.review"),
                captor.getAllValues().stream().map(RbacRolePermission::getPermissionCode).collect(java.util.stream.Collectors.toList())
        );
    }

    private RbacPermission permission(String code, String name) {
        RbacPermission permission = new RbacPermission();
        permission.setCode(code);
        permission.setName(name);
        return permission;
    }

    private RbacRolePermission rolePermission(String roleCode, String permissionCode) {
        RbacRolePermission rolePermission = new RbacRolePermission();
        rolePermission.setRoleCode(roleCode);
        rolePermission.setPermissionCode(permissionCode);
        return rolePermission;
    }
}
