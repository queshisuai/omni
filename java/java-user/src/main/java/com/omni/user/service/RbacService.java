package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.ResultCode;
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
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Arrays;

@Service
public class RbacService {
    private static final String ROLE_PLATFORM_SUPER_ADMIN = "platform_super_admin";
    private static final String PERMISSION_RBAC_MANAGE = "rbac.manage";

    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final RbacRolePermissionMapper rbacRolePermissionMapper;
    private final UserPermissionOverrideMapper userPermissionOverrideMapper;

    public RbacService(UserMapper userMapper,
                       SupportAccountMapper supportAccountMapper,
                       RbacPermissionMapper rbacPermissionMapper,
                       RbacRolePermissionMapper rbacRolePermissionMapper,
                       UserPermissionOverrideMapper userPermissionOverrideMapper) {
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.rbacRolePermissionMapper = rbacRolePermissionMapper;
        this.userPermissionOverrideMapper = userPermissionOverrideMapper;
    }

    public InternalAuthContextResponse getInternalAuthContext(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        String effectiveRole = resolveRole(user, resolveSupportAccount(user));
        List<String> permissions = applyUserPermissionOverrides(
                userId,
                effectiveRole,
                listRolePermissionCodes(effectiveRole)
        );

        InternalAuthContextResponse response = new InternalAuthContextResponse();
        response.setUserId(userId);
        response.setRole(user.getRole());
        response.setEffectiveRole(effectiveRole);
        response.setSupportRole(resolveSupportRole(effectiveRole));
        response.setPermissionCodes(permissions);
        response.setScopeType(resolveScopeType(effectiveRole));
        response.setScopeId(resolveScopeId(user));
        return response;
    }

    public void requireAnyPermission(Long userId, String... permissionCodes) {
        InternalAuthContextResponse context = getInternalAuthContext(userId);
        List<String> effective = context.getPermissionCodes() == null
                ? Collections.emptyList() : context.getPermissionCodes();
        if (Arrays.stream(permissionCodes).noneMatch(effective::contains)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限使用客服 AI 助手");
        }
    }

    private List<String> listRolePermissionCodes(String effectiveRole) {
        List<RbacRolePermission> rolePermissions = rbacRolePermissionMapper.selectList(
                new LambdaQueryWrapper<RbacRolePermission>().eq(RbacRolePermission::getRoleCode, effectiveRole)
        );
        if (rolePermissions == null) {
            return Collections.emptyList();
        }
        return rolePermissions.stream()
                .map(RbacRolePermission::getPermissionCode)
                .collect(Collectors.toList());
    }

    private List<String> applyUserPermissionOverrides(Long userId, String effectiveRole, List<String> inheritedPermissions) {
        LinkedHashSet<String> effectivePermissions = new LinkedHashSet<>(inheritedPermissions);
        List<UserPermissionOverride> overrides = userPermissionOverrideMapper.selectList(
                new LambdaQueryWrapper<UserPermissionOverride>().eq(UserPermissionOverride::getUserId, userId)
        );
        if (overrides != null) {
            for (UserPermissionOverride override : overrides) {
                if ("ALLOW".equals(override.getOverrideType())) {
                    effectivePermissions.add(override.getPermissionCode());
                } else if ("DENY".equals(override.getOverrideType())) {
                    effectivePermissions.remove(override.getPermissionCode());
                }
            }
        }
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole)) {
            effectivePermissions.add(PERMISSION_RBAC_MANAGE);
        }
        return new ArrayList<>(effectivePermissions);
    }

    public static String resolveRole(User user) {
        return resolveRole(user, null);
    }

    public static String resolveRole(User user, SupportAccount supportAccount) {
        String role = user.getRole();
        if (role == null) return "user";
        switch (role) {
            case "admin": return ROLE_PLATFORM_SUPER_ADMIN;
            case "support": return resolveSupportAccountRole(supportAccount);
            case "organizer": return "organizer";
            default: return role;
        }
    }

    private static String resolveSupportAccountRole(SupportAccount supportAccount) {
        if (supportAccount != null && supportAccount.getSupportRole() != null) {
            return supportAccount.getSupportRole();
        }
        return "support_agent";
    }

    private SupportAccount resolveSupportAccount(User user) {
        if (user == null || !"support".equals(user.getRole())) {
            return null;
        }
        return supportAccountMapper.selectById(user.getId());
    }

    private static String resolveSupportRole(String effectiveRole) {
        if (effectiveRole.startsWith("support_")) {
            return effectiveRole;
        }
        return null;
    }

    private static String resolveScopeType(String effectiveRole) {
        switch (effectiveRole) {
            case "platform_super_admin":
            case "organizer_admin":
            case "support_manager":
            case "support_agent": return "platform";
            case "organizer": return "organizer";
            default: return null;
        }
    }

    private static Long resolveScopeId(User user) {
        String effectiveRole = resolveRole(user);
        if ("organizer".equals(effectiveRole)) {
            return user.getId();
        }
        return null;
    }
}
