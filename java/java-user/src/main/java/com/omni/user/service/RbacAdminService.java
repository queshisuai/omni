package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.RbacPermissionResponse;
import com.omni.user.dto.RbacRoleResponse;
import com.omni.user.entity.RbacPermission;
import com.omni.user.entity.RbacRole;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRoleMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RbacAdminService {
    private static final String PERMISSION_RBAC_MANAGE = "rbac.manage";
    private static final String ROLE_PLATFORM_SUPER_ADMIN = "platform_super_admin";

    private final RbacRoleMapper roleMapper;
    private final RbacPermissionMapper permissionMapper;
    private final RbacRolePermissionMapper rolePermissionMapper;

    public RbacAdminService(RbacRoleMapper roleMapper,
                            RbacPermissionMapper permissionMapper,
                            RbacRolePermissionMapper rolePermissionMapper) {
        this.roleMapper = roleMapper;
        this.permissionMapper = permissionMapper;
        this.rolePermissionMapper = rolePermissionMapper;
    }

    public List<RbacRoleResponse> listRoles() {
        List<RbacRole> roles = roleMapper.selectList(new LambdaQueryWrapper<RbacRole>().orderByAsc(RbacRole::getCode));
        List<RbacRolePermission> rolePermissions = rolePermissionMapper.selectList(null);
        List<String> allPermissionCodes = listAllPermissionCodes();
        Map<String, List<String>> permissionsByRole = rolePermissions.stream()
                .collect(Collectors.groupingBy(RbacRolePermission::getRoleCode,
                        Collectors.mapping(RbacRolePermission::getPermissionCode, Collectors.toList())));
        return roles.stream()
                .map(role -> toRoleResponse(role, ROLE_PLATFORM_SUPER_ADMIN.equals(role.getCode())
                        ? allPermissionCodes
                        : permissionsByRole.get(role.getCode())))
                .collect(Collectors.toList());
    }

    public List<RbacPermissionResponse> listPermissions() {
        return permissionMapper.selectList(new LambdaQueryWrapper<RbacPermission>().orderByAsc(RbacPermission::getCode))
                .stream().map(this::toPermissionResponse).collect(Collectors.toList());
    }

    @Transactional
    public void updateRolePermissions(String roleCode, List<String> permissionCodes) {
        String normalizedRoleCode = requireText(roleCode, "角色编码不能为空");
        RbacRole role = roleMapper.selectOne(new LambdaQueryWrapper<RbacRole>().eq(RbacRole::getCode, normalizedRoleCode));
        if (role == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "角色不存在");
        }
        List<String> normalizedPermissionCodes = ROLE_PLATFORM_SUPER_ADMIN.equals(normalizedRoleCode)
                ? listAllPermissionCodes()
                : normalizePermissionCodes(permissionCodes);
        if (!normalizedPermissionCodes.isEmpty()) {
            List<RbacPermission> permissions = permissionMapper.selectList(
                    new LambdaQueryWrapper<RbacPermission>().in(RbacPermission::getCode, normalizedPermissionCodes));
            Set<String> existingCodes = permissions.stream().map(RbacPermission::getCode).collect(Collectors.toSet());
            List<String> missingCodes = normalizedPermissionCodes.stream()
                    .filter(code -> !existingCodes.contains(code))
                    .collect(Collectors.toList());
            if (!missingCodes.isEmpty()) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "权限不存在：" + String.join("、", missingCodes));
            }
        }
        protectLastRbacManager(normalizedRoleCode, normalizedPermissionCodes);
        rolePermissionMapper.delete(new QueryWrapper<RbacRolePermission>().eq("role_code", normalizedRoleCode));
        LocalDateTime now = LocalDateTime.now();
        for (String permissionCode : normalizedPermissionCodes) {
            RbacRolePermission item = new RbacRolePermission();
            item.setRoleCode(normalizedRoleCode);
            item.setPermissionCode(permissionCode);
            item.setCreateTime(now);
            rolePermissionMapper.insert(item);
        }
    }

    private RbacRoleResponse toRoleResponse(RbacRole role, List<String> permissionCodes) {
        RbacRoleResponse response = new RbacRoleResponse();
        response.setCode(role.getCode());
        response.setName(role.getName());
        response.setStatus(role.getStatus());
        response.setPermissionCodes(permissionCodes);
        return response;
    }

    private RbacPermissionResponse toPermissionResponse(RbacPermission permission) {
        RbacPermissionResponse response = new RbacPermissionResponse();
        response.setCode(permission.getCode());
        response.setName(permission.getName());
        response.setDescription(permission.getDescription());
        return response;
    }

    private List<String> normalizePermissionCodes(List<String> permissionCodes) {
        Set<String> seen = new HashSet<>();
        List<String> normalized = new ArrayList<>();
        if (permissionCodes == null) {
            return normalized;
        }
        for (String permissionCode : permissionCodes) {
            if (!StringUtils.hasText(permissionCode)) {
                continue;
            }
            String trimmed = permissionCode.trim();
            if (seen.add(trimmed)) {
                normalized.add(trimmed);
            }
        }
        return normalized;
    }

    private List<String> listAllPermissionCodes() {
        return permissionMapper.selectList(new LambdaQueryWrapper<RbacPermission>().orderByAsc(RbacPermission::getCode))
                .stream()
                .map(RbacPermission::getCode)
                .collect(Collectors.toList());
    }

    private String requireText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private void protectLastRbacManager(String roleCode, List<String> nextPermissionCodes) {
        if (nextPermissionCodes.contains(PERMISSION_RBAC_MANAGE)) {
            return;
        }
        Long currentRoleHasManage = rolePermissionMapper.selectCount(new QueryWrapper<RbacRolePermission>()
                .eq("role_code", roleCode)
                .eq("permission_code", PERMISSION_RBAC_MANAGE));
        if (currentRoleHasManage == null || currentRoleHasManage == 0) {
            return;
        }
        Long managerRoleCount = rolePermissionMapper.selectCount(new QueryWrapper<RbacRolePermission>()
                .eq("permission_code", PERMISSION_RBAC_MANAGE));
        if (managerRoleCount == null || managerRoleCount <= 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "至少保留一个拥有角色权限管理的角色");
        }
    }
}
