package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.entity.User;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RbacService {

    private final UserMapper userMapper;
    private final RbacRolePermissionMapper rbacRolePermissionMapper;

    public RbacService(UserMapper userMapper, RbacRolePermissionMapper rbacRolePermissionMapper) {
        this.userMapper = userMapper;
        this.rbacRolePermissionMapper = rbacRolePermissionMapper;
    }

    public InternalAuthContextResponse getInternalAuthContext(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        String effectiveRole = resolveRole(user);
        List<RbacRolePermission> rolePermissions = rbacRolePermissionMapper.selectList(
                new LambdaQueryWrapper<RbacRolePermission>().eq(RbacRolePermission::getRoleCode, effectiveRole)
        );
        List<String> permissions = rolePermissions.stream()
                .map(RbacRolePermission::getPermissionCode)
                .collect(Collectors.toList());

        InternalAuthContextResponse response = new InternalAuthContextResponse();
        response.setUserId(userId);
        response.setRole(user.getRole());
        response.setEffectiveRole(effectiveRole);
        response.setSupportRole(resolveSupportRole(user));
        response.setPermissionCodes(permissions);
        response.setScopeType(resolveScopeType(effectiveRole));
        response.setScopeId(resolveScopeId(user));
        return response;
    }

    public static String resolveRole(User user) {
        String role = user.getRole();
        if (role == null) return "user";
        switch (role) {
            case "admin": return "platform_super_admin";
            case "support": return "support_agent";
            case "organizer": return "organizer_admin";
            default: return role;
        }
    }

    private static String resolveSupportRole(User user) {
        String effectiveRole = resolveRole(user);
        if (effectiveRole.startsWith("support_")) {
            return effectiveRole;
        }
        return null;
    }

    private static String resolveScopeType(String effectiveRole) {
        switch (effectiveRole) {
            case "organizer_admin": return "organizer";
            case "platform_super_admin":
            case "support_manager":
            case "support_agent": return "platform";
            default: return null;
        }
    }

    private static Long resolveScopeId(User user) {
        String effectiveRole = resolveRole(user);
        if ("organizer_admin".equals(effectiveRole)) {
            return user.getId();
        }
        return null;
    }
}
