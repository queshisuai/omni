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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
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
    public RolePermissionUpdateResult updateRolePermissions(String roleCode, List<String> permissionCodes) {
        String normalizedRoleCode = requireText(roleCode, "角色编码不能为空");
        RbacRole role = roleMapper.selectOne(new LambdaQueryWrapper<RbacRole>().eq(RbacRole::getCode, normalizedRoleCode));
        if (role == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "角色不存在");
        }

        List<String> beforePermissionCodes = listRolePermissionCodes(normalizedRoleCode);
        List<String> normalizedPermissionCodes;
        List<RbacPermission> permissions;
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(normalizedRoleCode)) {
            permissions = listAllPermissions();
            normalizedPermissionCodes = permissions.stream()
                    .map(RbacPermission::getCode)
                    .collect(Collectors.toList());
        } else {
            normalizedPermissionCodes = normalizePermissionCodes(permissionCodes);
            permissions = listPermissionsForCodes(mergePermissionCodes(beforePermissionCodes, normalizedPermissionCodes));
        }

        if (!normalizedPermissionCodes.isEmpty()) {
            Map<String, RbacPermission> permissionsByCode = permissions.stream()
                    .collect(Collectors.toMap(RbacPermission::getCode, permission -> permission, (left, right) -> left));
            List<String> missingCodes = normalizedPermissionCodes.stream()
                    .filter(code -> !permissionsByCode.containsKey(code))
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
        return buildRolePermissionUpdateResult(
                normalizedRoleCode,
                beforePermissionCodes,
                normalizedPermissionCodes,
                permissions
        );
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
        return listAllPermissions()
                .stream()
                .map(RbacPermission::getCode)
                .collect(Collectors.toList());
    }

    private List<RbacPermission> listAllPermissions() {
        List<RbacPermission> permissions = permissionMapper.selectList(
                new LambdaQueryWrapper<RbacPermission>().orderByAsc(RbacPermission::getCode));
        return permissions == null ? Collections.emptyList() : permissions;
    }

    private List<RbacPermission> listPermissionsForCodes(List<String> permissionCodes) {
        if (permissionCodes.isEmpty()) {
            return Collections.emptyList();
        }
        List<RbacPermission> permissions = permissionMapper.selectList(
                new LambdaQueryWrapper<RbacPermission>().in(RbacPermission::getCode, permissionCodes));
        return permissions == null ? Collections.emptyList() : permissions;
    }

    private List<String> listRolePermissionCodes(String roleCode) {
        List<RbacRolePermission> rolePermissions = rolePermissionMapper.selectList(
                new QueryWrapper<RbacRolePermission>().eq("role_code", roleCode));
        if (rolePermissions == null) {
            return Collections.emptyList();
        }
        return rolePermissions.stream()
                .map(RbacRolePermission::getPermissionCode)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
    }

    private List<String> mergePermissionCodes(List<String> beforePermissionCodes, List<String> afterPermissionCodes) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        codes.addAll(beforePermissionCodes);
        codes.addAll(afterPermissionCodes);
        return new ArrayList<>(codes);
    }

    private RolePermissionUpdateResult buildRolePermissionUpdateResult(
            String roleCode,
            List<String> beforePermissionCodes,
            List<String> afterPermissionCodes,
            List<RbacPermission> permissions) {
        Map<String, RbacPermission> permissionsByCode = permissions.stream()
                .collect(Collectors.toMap(RbacPermission::getCode, permission -> permission, (left, right) -> left));
        Set<String> beforeCodeSet = new HashSet<>(beforePermissionCodes);
        Set<String> afterCodeSet = new HashSet<>(afterPermissionCodes);
        List<PermissionChangeItem> addedPermissions = afterPermissionCodes.stream()
                .filter(code -> !beforeCodeSet.contains(code))
                .map(code -> toPermissionChangeItem(code, permissionsByCode))
                .collect(Collectors.toList());
        List<PermissionChangeItem> removedPermissions = beforePermissionCodes.stream()
                .filter(code -> !afterCodeSet.contains(code))
                .map(code -> toPermissionChangeItem(code, permissionsByCode))
                .collect(Collectors.toList());
        return new RolePermissionUpdateResult(
                roleCode,
                beforePermissionCodes,
                afterPermissionCodes,
                addedPermissions,
                removedPermissions
        );
    }

    private PermissionChangeItem toPermissionChangeItem(String permissionCode, Map<String, RbacPermission> permissionsByCode) {
        RbacPermission permission = permissionsByCode.get(permissionCode);
        String permissionName = permission == null || !StringUtils.hasText(permission.getName())
                ? permissionCode
                : permission.getName();
        return new PermissionChangeItem(permissionCode, permissionName);
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

    public static class PermissionChangeItem {
        private final String code;
        private final String name;

        public PermissionChangeItem(String code, String name) {
            this.code = code;
            this.name = name;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public String toAuditText() {
            return name + "（" + code + "）";
        }
    }

    public static class RolePermissionUpdateResult {
        private final String roleCode;
        private final List<String> beforePermissionCodes;
        private final List<String> afterPermissionCodes;
        private final List<PermissionChangeItem> addedPermissions;
        private final List<PermissionChangeItem> removedPermissions;

        public RolePermissionUpdateResult(String roleCode,
                                          List<String> beforePermissionCodes,
                                          List<String> afterPermissionCodes,
                                          List<PermissionChangeItem> addedPermissions,
                                          List<PermissionChangeItem> removedPermissions) {
            this.roleCode = roleCode;
            this.beforePermissionCodes = List.copyOf(beforePermissionCodes);
            this.afterPermissionCodes = List.copyOf(afterPermissionCodes);
            this.addedPermissions = List.copyOf(addedPermissions);
            this.removedPermissions = List.copyOf(removedPermissions);
        }

        public String getRoleCode() {
            return roleCode;
        }

        public List<String> getBeforePermissionCodes() {
            return beforePermissionCodes;
        }

        public List<String> getAfterPermissionCodes() {
            return afterPermissionCodes;
        }

        public List<PermissionChangeItem> getAddedPermissions() {
            return addedPermissions;
        }

        public List<PermissionChangeItem> getRemovedPermissions() {
            return removedPermissions;
        }

        public List<String> getAddedPermissionCodes() {
            return addedPermissions.stream().map(PermissionChangeItem::getCode).collect(Collectors.toList());
        }

        public List<String> getRemovedPermissionCodes() {
            return removedPermissions.stream().map(PermissionChangeItem::getCode).collect(Collectors.toList());
        }

        public String toAuditSummary() {
            return "新增权限：" + formatChangeItems(addedPermissions)
                    + "；移除权限：" + formatChangeItems(removedPermissions)
                    + "；更新后权限数：" + afterPermissionCodes.size();
        }

        private String formatChangeItems(List<PermissionChangeItem> permissions) {
            if (permissions.isEmpty()) {
                return "无";
            }
            return permissions.stream()
                    .map(PermissionChangeItem::toAuditText)
                    .collect(Collectors.joining("、"));
        }
    }
}
