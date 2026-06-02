package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RbacService {

    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final RbacRolePermissionMapper rbacRolePermissionMapper;

    public RbacService(UserMapper userMapper,
                       SupportAccountMapper supportAccountMapper,
                       RbacRolePermissionMapper rbacRolePermissionMapper) {
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.rbacRolePermissionMapper = rbacRolePermissionMapper;
    }

    public InternalAuthContextResponse getInternalAuthContext(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        String effectiveRole = resolveRole(user, resolveSupportAccount(user));
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
        response.setSupportRole(resolveSupportRole(effectiveRole));
        response.setPermissionCodes(permissions);
        response.setScopeType(resolveScopeType(effectiveRole));
        response.setScopeId(resolveScopeId(user));
        return response;
    }

    public static String resolveRole(User user) {
        return resolveRole(user, null);
    }

    private static String resolveRole(User user, SupportAccount supportAccount) {
        String role = user.getRole();
        if (role == null) return "user";
        switch (role) {
            case "admin": return "platform_super_admin";
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
