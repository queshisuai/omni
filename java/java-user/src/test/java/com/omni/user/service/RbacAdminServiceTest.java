package com.omni.user.service;

import com.omni.user.entity.RbacPermission;
import com.omni.user.entity.RbacRole;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.entity.UserPermissionOverride;
import com.omni.user.dto.RbacUserPermissionOverrideUpdateRequest;
import com.omni.user.dto.RbacUserPermissionResponse;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRoleMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import com.omni.user.mapper.UserPermissionOverrideMapper;
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
    private final UserMapper userMapper = mock(UserMapper.class);
    private final SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
    private final UserPermissionOverrideMapper userPermissionOverrideMapper = mock(UserPermissionOverrideMapper.class);
    private final RbacAdminService service = new RbacAdminService(
            roleMapper,
            permissionMapper,
            rolePermissionMapper,
            userMapper,
            supportAccountMapper,
            userPermissionOverrideMapper
    );

    @Test
    void listsRolesWithAssignedPermissionCodes() {
        RbacRole role = role("support_manager", "客服主管");
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
    void listsRolesInApprovedBusinessOrder() {
        when(roleMapper.selectList(any())).thenReturn(List.of(
                role("support_agent", "普通客服"),
                role("organizer_admin", "平台主办方运营员"),
                role("platform_super_admin", "平台超管"),
                role("support_manager", "客服主管"),
                role("organizer", "主办方主账号")
        ));
        when(permissionMapper.selectList(any())).thenReturn(List.of(permission("rbac.manage", "角色权限管理")));
        when(rolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("platform_super_admin", "rbac.manage")
        ));

        List<com.omni.user.dto.RbacRoleResponse> roles = service.listRoles();

        assertEquals(
                List.of("platform_super_admin", "organizer", "organizer_admin", "support_manager", "support_agent"),
                roles.stream().map(com.omni.user.dto.RbacRoleResponse::getCode).collect(java.util.stream.Collectors.toList())
        );
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
    void platformSuperAdminOnlyForcesRbacManageAndAllowsOtherPermissionsToBeRemoved() {
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

        service.updateRolePermissions("platform_super_admin", List.of("station.review"));

        ArgumentCaptor<RbacRolePermission> captor = ArgumentCaptor.forClass(RbacRolePermission.class);
        verify(rolePermissionMapper).delete(any());
        verify(rolePermissionMapper, times(2)).insert(captor.capture());
        assertEquals(
                List.of("station.review", "rbac.manage"),
                captor.getAllValues().stream().map(RbacRolePermission::getPermissionCode).collect(java.util.stream.Collectors.toList())
        );
    }

    @Test
    void returnsUserPermissionViewWithAllowAndDenyOverrides() {
        when(userMapper.selectById(7L)).thenReturn(user(7L, "support", "张晓", "13900000007"));
        when(supportAccountMapper.selectById(7L)).thenReturn(supportAccount(7L, "support_agent"));
        when(roleMapper.selectList(any())).thenReturn(List.of(role("support_agent", "普通客服")));
        when(rolePermissionMapper.selectList(any())).thenReturn(List.of(
                rolePermission("support_agent", "support.conversation.view"),
                rolePermission("support_agent", "audit.view")
        ));
        when(userPermissionOverrideMapper.selectList(any())).thenReturn(List.of(
                permissionOverride(7L, "order.view", "ALLOW"),
                permissionOverride(7L, "audit.view", "DENY")
        ));

        RbacUserPermissionResponse response = service.getUserPermissionOverrides(7L);

        assertEquals(7L, response.getUserId());
        assertEquals("support_agent", response.getEffectiveRole());
        assertEquals("普通客服", response.getBaseRoleName());
        assertEquals(List.of("support.conversation.view", "audit.view"), response.getInheritedPermissionCodes());
        assertEquals(List.of("order.view"), response.getAllowPermissionCodes());
        assertEquals(List.of("audit.view"), response.getDenyPermissionCodes());
        assertEquals(List.of("support.conversation.view", "order.view"), response.getEffectivePermissionCodes());
    }

    @Test
    void superAdminUserOverrideCannotDenyRbacManage() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", "平台超管", "13900000001"));
        when(permissionMapper.selectList(any())).thenReturn(List.of(
                permission("rbac.manage", "角色权限管理"),
                permission("activity.manage", "活动管理"),
                permission("order.view", "订单查看")
        ));
        RbacUserPermissionOverrideUpdateRequest request = new RbacUserPermissionOverrideUpdateRequest();
        request.setAllowPermissionCodes(List.of("order.view"));
        request.setDenyPermissionCodes(List.of("rbac.manage", "activity.manage"));
        request.setReason("临时收敛演出权限");

        service.updateUserPermissionOverrides(1L, request);

        ArgumentCaptor<UserPermissionOverride> captor = ArgumentCaptor.forClass(UserPermissionOverride.class);
        verify(userPermissionOverrideMapper).delete(any());
        verify(userPermissionOverrideMapper, times(2)).insert(captor.capture());
        assertEquals(
                List.of("order.view:ALLOW", "activity.manage:DENY"),
                captor.getAllValues().stream()
                        .map(item -> item.getPermissionCode() + ":" + item.getOverrideType())
                        .collect(java.util.stream.Collectors.toList())
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

    private RbacRole role(String code, String name) {
        RbacRole role = new RbacRole();
        role.setCode(code);
        role.setName(name);
        role.setStatus(1);
        return role;
    }

    private User user(Long id, String roleCode, String nickname, String phone) {
        User user = new User();
        user.setId(id);
        user.setRole(roleCode);
        user.setNickname(nickname);
        user.setPhone(phone);
        user.setStatus(1);
        return user;
    }

    private SupportAccount supportAccount(Long userId, String supportRole) {
        SupportAccount account = new SupportAccount();
        account.setUserId(userId);
        account.setSupportRole(supportRole);
        account.setStatus(1);
        return account;
    }

    private UserPermissionOverride permissionOverride(Long userId, String permissionCode, String overrideType) {
        UserPermissionOverride override = new UserPermissionOverride();
        override.setUserId(userId);
        override.setPermissionCode(permissionCode);
        override.setOverrideType(overrideType);
        return override;
    }
}
