package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.RbacPermissionResponse;
import com.omni.user.dto.RbacRoleResponse;
import com.omni.user.dto.RbacUserPermissionOverrideUpdateRequest;
import com.omni.user.dto.RbacUserPermissionResponse;
import com.omni.user.dto.RbacUserPermissionSummaryResponse;
import com.omni.user.entity.RbacPermission;
import com.omni.user.entity.RbacRole;
import com.omni.user.entity.RbacRolePermission;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.entity.UserPermissionOverride;
import com.omni.user.mapper.RbacPermissionMapper;
import com.omni.user.mapper.RbacRoleMapper;
import com.omni.user.mapper.RbacRolePermissionMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import com.omni.user.mapper.UserPermissionOverrideMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
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
    private static final List<String> ROLE_ORDER = List.of(
            ROLE_PLATFORM_SUPER_ADMIN,
            "organizer",
            "organizer_admin",
            "support_manager",
            "support_agent"
    );

    private final RbacRoleMapper roleMapper;
    private final RbacPermissionMapper permissionMapper;
    private final RbacRolePermissionMapper rolePermissionMapper;
    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final UserPermissionOverrideMapper userPermissionOverrideMapper;

    public RbacAdminService(RbacRoleMapper roleMapper,
                            RbacPermissionMapper permissionMapper,
                            RbacRolePermissionMapper rolePermissionMapper,
                            UserMapper userMapper,
                            SupportAccountMapper supportAccountMapper,
                            UserPermissionOverrideMapper userPermissionOverrideMapper) {
        this.roleMapper = roleMapper;
        this.permissionMapper = permissionMapper;
        this.rolePermissionMapper = rolePermissionMapper;
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.userPermissionOverrideMapper = userPermissionOverrideMapper;
    }

    public List<RbacRoleResponse> listRoles() {
        List<RbacRole> roles = roleMapper.selectList(new LambdaQueryWrapper<RbacRole>().orderByAsc(RbacRole::getCode));
        List<RbacRolePermission> rolePermissions = rolePermissionMapper.selectList(null);
        List<String> allPermissionCodes = listAllPermissionCodes();
        Map<String, List<String>> permissionsByRole = safeList(rolePermissions).stream()
                .collect(Collectors.groupingBy(RbacRolePermission::getRoleCode,
                        Collectors.mapping(RbacRolePermission::getPermissionCode, Collectors.toList())));
        return safeList(roles).stream()
                .sorted((left, right) -> {
                    int leftRank = roleRank(left.getCode());
                    int rightRank = roleRank(right.getCode());
                    if (leftRank != rightRank) return Integer.compare(leftRank, rightRank);
                    return nullSafe(left.getCode()).compareTo(nullSafe(right.getCode()));
                })
                .map(role -> toRoleResponse(role, resolveRolePermissionCodesForList(role, permissionsByRole, allPermissionCodes)))
                .collect(Collectors.toList());
    }

    public List<RbacPermissionResponse> listPermissions() {
        return safeList(permissionMapper.selectList(new LambdaQueryWrapper<RbacPermission>().orderByAsc(RbacPermission::getCode)))
                .stream().map(this::toPermissionResponse).collect(Collectors.toList());
    }

    public List<RbacUserPermissionSummaryResponse> searchUsersForPermissionOverride(String keyword) {
        String normalized = keyword == null ? "" : keyword.trim();
        if (!StringUtils.hasText(normalized)) {
            return Collections.emptyList();
        }
        Long parsedUserId = parseUserId(normalized);
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.and(query -> {
            if (parsedUserId != null) {
                query.eq("id", parsedUserId).or();
            }
            query.like("nickname", normalized).or().like("phone", normalized);
        });
        wrapper.orderByAsc("id").last("LIMIT 10");
        Map<String, String> roleNames = listRoleNames();
        return safeList(userMapper.selectList(wrapper)).stream()
                .map(user -> toUserPermissionSummary(user, roleNames))
                .collect(Collectors.toList());
    }

    public RbacUserPermissionResponse getUserPermissionOverrides(Long userId) {
        User user = requireUser(userId);
        String effectiveRole = RbacService.resolveRole(user, resolveSupportAccount(user));
        List<String> inheritedPermissionCodes = resolveInheritedPermissionCodes(effectiveRole);
        List<UserPermissionOverride> overrides = listUserPermissionOverrides(userId);
        List<String> allowPermissionCodes = normalizePermissionCodes(overrides.stream()
                .filter(override -> "ALLOW".equals(override.getOverrideType()))
                .map(UserPermissionOverride::getPermissionCode)
                .collect(Collectors.toList()));
        List<String> denyPermissionCodes = normalizePermissionCodes(overrides.stream()
                .filter(override -> "DENY".equals(override.getOverrideType()))
                .map(UserPermissionOverride::getPermissionCode)
                .collect(Collectors.toList()));
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole)) {
            denyPermissionCodes = denyPermissionCodes.stream()
                    .filter(code -> !PERMISSION_RBAC_MANAGE.equals(code))
                    .collect(Collectors.toList());
        }
        return buildUserPermissionResponse(user, effectiveRole, inheritedPermissionCodes, allowPermissionCodes, denyPermissionCodes);
    }

    public RbacUserPermissionResponse updateUserPermissionOverrides(Long userId, RbacUserPermissionOverrideUpdateRequest request) {
        return updateUserPermissionOverrides(userId, request, userId);
    }

    @Transactional
    public RbacUserPermissionResponse updateUserPermissionOverrides(Long userId,
                                                                    RbacUserPermissionOverrideUpdateRequest request,
                                                                    Long operatorId) {
        User user = requireUser(userId);
        String effectiveRole = RbacService.resolveRole(user, resolveSupportAccount(user));
        RbacUserPermissionOverrideUpdateRequest safeRequest = request == null
                ? new RbacUserPermissionOverrideUpdateRequest()
                : request;
        List<String> allowPermissionCodes = normalizePermissionCodes(safeRequest.getAllowPermissionCodes());
        List<String> denyPermissionCodes = normalizePermissionCodes(safeRequest.getDenyPermissionCodes());
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole)) {
            denyPermissionCodes = denyPermissionCodes.stream()
                    .filter(code -> !PERMISSION_RBAC_MANAGE.equals(code))
                    .collect(Collectors.toList());
        }
        rejectOverlappingOverrideCodes(allowPermissionCodes, denyPermissionCodes);
        validatePermissionCodes(mergePermissionCodes(allowPermissionCodes, denyPermissionCodes));

        userPermissionOverrideMapper.delete(new QueryWrapper<UserPermissionOverride>().eq("user_id", userId));
        LocalDateTime now = LocalDateTime.now();
        Long createBy = operatorId == null ? userId : operatorId;
        for (String permissionCode : allowPermissionCodes) {
            userPermissionOverrideMapper.insert(toUserPermissionOverride(userId, permissionCode, "ALLOW", safeRequest.getReason(), createBy, now));
        }
        for (String permissionCode : denyPermissionCodes) {
            userPermissionOverrideMapper.insert(toUserPermissionOverride(userId, permissionCode, "DENY", safeRequest.getReason(), createBy, now));
        }

        return buildUserPermissionResponse(
                user,
                effectiveRole,
                resolveInheritedPermissionCodes(effectiveRole),
                allowPermissionCodes,
                denyPermissionCodes
        );
    }

    @Transactional
    public RolePermissionUpdateResult updateRolePermissions(String roleCode, List<String> permissionCodes) {
        String normalizedRoleCode = requireText(roleCode, "角色编码不能为空");
        RbacRole role = roleMapper.selectOne(new LambdaQueryWrapper<RbacRole>().eq(RbacRole::getCode, normalizedRoleCode));
        if (role == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "角色不存在");
        }

        List<String> beforePermissionCodes = listRolePermissionCodes(normalizedRoleCode);
        List<String> normalizedPermissionCodes = normalizePermissionCodes(permissionCodes);
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(normalizedRoleCode)
                && !normalizedPermissionCodes.contains(PERMISSION_RBAC_MANAGE)) {
            normalizedPermissionCodes.add(PERMISSION_RBAC_MANAGE);
        }
        List<RbacPermission> permissions = listPermissionsForCodes(mergePermissionCodes(beforePermissionCodes, normalizedPermissionCodes));
        validatePermissionCodes(normalizedPermissionCodes, permissions);
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

    private RbacUserPermissionSummaryResponse toUserPermissionSummary(User user, Map<String, String> roleNames) {
        String effectiveRole = RbacService.resolveRole(user, resolveSupportAccount(user));
        RbacUserPermissionSummaryResponse response = new RbacUserPermissionSummaryResponse();
        response.setUserId(user.getId());
        response.setNickname(user.getNickname());
        response.setPhone(user.getPhone());
        response.setRole(user.getRole());
        response.setEffectiveRole(effectiveRole);
        response.setBaseRoleName(resolveRoleName(effectiveRole, roleNames));
        return response;
    }

    private RbacUserPermissionResponse buildUserPermissionResponse(User user,
                                                                   String effectiveRole,
                                                                   List<String> inheritedPermissionCodes,
                                                                   List<String> allowPermissionCodes,
                                                                   List<String> denyPermissionCodes) {
        RbacUserPermissionSummaryResponse summary = toUserPermissionSummary(user, listRoleNames());
        RbacUserPermissionResponse response = new RbacUserPermissionResponse();
        response.setUserId(summary.getUserId());
        response.setNickname(summary.getNickname());
        response.setPhone(summary.getPhone());
        response.setRole(summary.getRole());
        response.setEffectiveRole(effectiveRole);
        response.setBaseRoleName(summary.getBaseRoleName());
        response.setInheritedPermissionCodes(inheritedPermissionCodes);
        response.setAllowPermissionCodes(allowPermissionCodes);
        response.setDenyPermissionCodes(denyPermissionCodes);
        response.setEffectivePermissionCodes(calculateEffectivePermissionCodes(
                effectiveRole,
                inheritedPermissionCodes,
                allowPermissionCodes,
                denyPermissionCodes
        ));
        return response;
    }

    private UserPermissionOverride toUserPermissionOverride(Long userId, String permissionCode, String overrideType,
                                                            String reason, Long createBy, LocalDateTime now) {
        UserPermissionOverride override = new UserPermissionOverride();
        override.setUserId(userId);
        override.setPermissionCode(permissionCode);
        override.setOverrideType(overrideType);
        override.setReason(StringUtils.hasText(reason) ? reason.trim() : null);
        override.setCreateBy(createBy);
        override.setCreateTime(now);
        override.setUpdateTime(now);
        return override;
    }

    private List<String> calculateEffectivePermissionCodes(String effectiveRole,
                                                           List<String> inheritedPermissionCodes,
                                                           List<String> allowPermissionCodes,
                                                           List<String> denyPermissionCodes) {
        LinkedHashSet<String> effectivePermissionCodes = new LinkedHashSet<>();
        effectivePermissionCodes.addAll(inheritedPermissionCodes);
        effectivePermissionCodes.addAll(allowPermissionCodes);
        denyPermissionCodes.forEach(effectivePermissionCodes::remove);
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole)) {
            effectivePermissionCodes.add(PERMISSION_RBAC_MANAGE);
        }
        return new ArrayList<>(effectivePermissionCodes);
    }

    private List<String> resolveInheritedPermissionCodes(String effectiveRole) {
        List<String> rolePermissionCodes = listRolePermissionCodes(effectiveRole);
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole) && rolePermissionCodes.isEmpty()) {
            rolePermissionCodes = listAllPermissionCodes();
        }
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(effectiveRole) && !rolePermissionCodes.contains(PERMISSION_RBAC_MANAGE)) {
            rolePermissionCodes = new ArrayList<>(rolePermissionCodes);
            rolePermissionCodes.add(PERMISSION_RBAC_MANAGE);
        }
        return normalizePermissionCodes(rolePermissionCodes);
    }

    private List<UserPermissionOverride> listUserPermissionOverrides(Long userId) {
        return safeList(userPermissionOverrideMapper.selectList(
                new QueryWrapper<UserPermissionOverride>().eq("user_id", userId).orderByAsc("permission_code")));
    }

    private SupportAccount resolveSupportAccount(User user) {
        if (user == null || !"support".equals(user.getRole())) {
            return null;
        }
        return supportAccountMapper.selectById(user.getId());
    }

    private Map<String, String> listRoleNames() {
        Map<String, String> roleNames = new HashMap<>();
        for (RbacRole role : safeList(roleMapper.selectList(new LambdaQueryWrapper<RbacRole>().orderByAsc(RbacRole::getCode)))) {
            roleNames.put(role.getCode(), role.getName());
        }
        return roleNames;
    }

    private String resolveRoleName(String roleCode, Map<String, String> roleNames) {
        String configuredName = roleNames.get(roleCode);
        if (StringUtils.hasText(configuredName)) {
            return configuredName;
        }
        switch (roleCode) {
            case ROLE_PLATFORM_SUPER_ADMIN: return "平台超管";
            case "organizer": return "主办方主账号";
            case "organizer_admin": return "平台主办方运营员";
            case "support_manager": return "客服主管";
            case "support_agent": return "普通客服";
            default: return roleCode;
        }
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

    private void validatePermissionCodes(List<String> permissionCodes) {
        validatePermissionCodes(permissionCodes, listPermissionsForCodes(permissionCodes));
    }

    private void validatePermissionCodes(List<String> permissionCodes, List<RbacPermission> permissions) {
        if (permissionCodes.isEmpty()) {
            return;
        }
        Map<String, RbacPermission> permissionsByCode = permissions.stream()
                .collect(Collectors.toMap(RbacPermission::getCode, permission -> permission, (left, right) -> left));
        List<String> missingCodes = permissionCodes.stream()
                .filter(code -> !permissionsByCode.containsKey(code))
                .collect(Collectors.toList());
        if (!missingCodes.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "权限不存在：" + String.join("、", missingCodes));
        }
    }

    private void rejectOverlappingOverrideCodes(List<String> allowPermissionCodes, List<String> denyPermissionCodes) {
        Set<String> denySet = new HashSet<>(denyPermissionCodes);
        List<String> overlappingCodes = allowPermissionCodes.stream()
                .filter(denySet::contains)
                .collect(Collectors.toList());
        if (!overlappingCodes.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST,
                    "同一权限不能同时特许开放和显式禁用：" + String.join("、", overlappingCodes));
        }
    }

    private User requireUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private String requireText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private List<String> resolveRolePermissionCodesForList(RbacRole role,
                                                           Map<String, List<String>> permissionsByRole,
                                                           List<String> allPermissionCodes) {
        List<String> permissionCodes = permissionsByRole.get(role.getCode());
        if (ROLE_PLATFORM_SUPER_ADMIN.equals(role.getCode())) {
            if (permissionCodes == null || permissionCodes.isEmpty()) {
                return allPermissionCodes;
            }
            List<String> normalized = normalizePermissionCodes(permissionCodes);
            if (!normalized.contains(PERMISSION_RBAC_MANAGE)) {
                normalized.add(PERMISSION_RBAC_MANAGE);
            }
            return normalized;
        }
        return permissionCodes;
    }

    private int roleRank(String roleCode) {
        int rank = ROLE_ORDER.indexOf(roleCode);
        return rank < 0 ? Integer.MAX_VALUE : rank;
    }

    private Long parseUserId(String keyword) {
        if (!keyword.matches("\\d+")) {
            return null;
        }
        try {
            return Long.valueOf(keyword);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private <T> List<T> safeList(List<T> items) {
        return items == null ? Collections.emptyList() : items;
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
