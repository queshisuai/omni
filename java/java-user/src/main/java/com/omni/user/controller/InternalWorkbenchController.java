package com.omni.user.controller;

import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerAdminAccountRequest;
import com.omni.user.dto.OrganizerAdminAccountResponse;
import com.omni.user.dto.OperationAuditLogResponse;
import com.omni.user.dto.RbacPermissionResponse;
import com.omni.user.dto.RbacRolePermissionUpdateRequest;
import com.omni.user.dto.RbacRoleResponse;
import com.omni.user.service.OrganizerAdminAccountService;
import com.omni.user.service.OperationAuditService;
import com.omni.user.service.RbacAdminService;
import com.omni.user.service.RbacService;
import com.omni.user.service.ExceptionWorkbenchService;
import com.omni.user.service.ReconciliationService;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.util.StringUtils;

@RestController
@RequestMapping("/api/user/console")
public class InternalWorkbenchController {
    private static final Logger log = LoggerFactory.getLogger(InternalWorkbenchController.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final ExceptionWorkbenchService exceptionWorkbenchService;
    private final ReconciliationService reconciliationService;
    private final RbacAdminService rbacAdminService;
    private final OrganizerAdminAccountService organizerAdminAccountService;
    private final OperationAuditService operationAuditService;
    private final RbacService rbacService;

    public InternalWorkbenchController(ExceptionWorkbenchService exceptionWorkbenchService,
                                       ReconciliationService reconciliationService,
                                       RbacAdminService rbacAdminService,
                                       OrganizerAdminAccountService organizerAdminAccountService,
                                       OperationAuditService operationAuditService,
                                       RbacService rbacService) {
        this.exceptionWorkbenchService = exceptionWorkbenchService;
        this.reconciliationService = reconciliationService;
        this.rbacAdminService = rbacAdminService;
        this.organizerAdminAccountService = organizerAdminAccountService;
        this.operationAuditService = operationAuditService;
        this.rbacService = rbacService;
    }

    @GetMapping("/rbac/roles")
    public Result<java.util.List<RbacRoleResponse>> listRoles(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "rbac.manage");
        return Result.success(rbacAdminService.listRoles());
    }

    @GetMapping("/rbac/permissions")
    public Result<java.util.List<RbacPermissionResponse>> listPermissions(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "rbac.manage");
        return Result.success(rbacAdminService.listPermissions());
    }

    @PutMapping("/rbac/roles/{roleCode}/permissions")
    public Result<Void> updateRolePermissions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String roleCode,
            @RequestBody(required = false) RbacRolePermissionUpdateRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "rbac.manage");
        rbacAdminService.updateRolePermissions(roleCode, request == null ? null : request.getPermissionCodes());
        int permissionCount = request == null || request.getPermissionCodes() == null ? 0 : request.getPermissionCodes().size();
        auditSuccess(userId, "rbac.role_permission.update", "rbac_role", null, roleCode,
                "更新角色授权", "权限数量：" + permissionCount);
        return Result.success();
    }

    @GetMapping("/organizer-admins")
    public Result<java.util.List<OrganizerAdminAccountResponse>> listOrganizerAdmins(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        return Result.success(organizerAdminAccountService.list());
    }

    @PostMapping("/organizer-admins")
    public Result<OrganizerAdminAccountResponse> createOrganizerAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody OrganizerAdminAccountRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        OrganizerAdminAccountResponse response = organizerAdminAccountService.create(request);
        auditSuccess(userId, "organizer_admin.create", "user", response.getId(), response.getPhone(),
                "创建主办方管理员", "创建成功");
        return Result.success(response);
    }

    @PostMapping("/organizer-admins/{id}/deactivate")
    public Result<OrganizerAdminAccountResponse> deactivateOrganizerAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        OrganizerAdminAccountResponse response = organizerAdminAccountService.deactivate(id);
        auditSuccess(userId, "organizer_admin.deactivate", "user", response.getId(), response.getPhone(),
                "停用主办方管理员", "停用成功");
        return Result.success(response);
    }

    @DeleteMapping("/organizer-admins/{id}")
    public Result<OrganizerAdminAccountResponse> deleteOrganizerAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        OrganizerAdminAccountResponse response = organizerAdminAccountService.deactivate(id);
        auditSuccess(userId, "organizer_admin.deactivate", "user", response.getId(), response.getPhone(),
                "停用主办方管理员", "停用成功");
        return Result.success(response);
    }

    @GetMapping("/audit-logs")
    public Result<java.util.List<OperationAuditLogResponse>> listAuditLogs(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Boolean success,
            @RequestParam(required = false) String traceId,
            @RequestParam(required = false) Integer limit) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "audit.view");
        return Result.success(operationAuditService.list(operatorId, action, targetType, success, traceId, limit));
    }

    @GetMapping("/exception-tasks")
    public Result<java.util.List<ExceptionTaskResponse>> listExceptionTasks(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        return Result.success(exceptionWorkbenchService.listByStatus(status));
    }

    @PostMapping("/exception-tasks")
    public Result<ExceptionTaskResponse> createExceptionTask(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody ExceptionTaskCreateRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        return Result.success(exceptionWorkbenchService.create(request));
    }

    @GetMapping("/reconciliation/batches")
    public Result<java.util.List<ReconciliationBatchResponse>> listBatches(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "reconcile.view");
        return Result.success(reconciliationService.listBatches());
    }

    @PostMapping("/reconciliation/batches")
    public Result<ReconciliationBatchResponse> createBatch(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody ReconciliationBatchCreateRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "reconcile.view");
        return Result.success(reconciliationService.createBatch(request));
    }

    private void requirePermission(Long userId, String permissionCode) {
        if (!rbacService.getInternalAuthContext(userId).getPermissionCodes().contains(permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }

    private Long parseUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            Claims claims = JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length()));
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }

    private void auditSuccess(Long operatorId, String action, String targetType, Long targetId,
                              String targetRef, String reason, String result) {
        try {
            InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
            OperationAuditWriteRequest request = new OperationAuditWriteRequest();
            request.setOperatorId(operatorId);
            request.setOperatorRole(auth.getEffectiveRole() == null ? "unknown" : auth.getEffectiveRole());
            request.setAction(action);
            request.setTargetType(targetType);
            request.setTargetId(targetId);
            request.setTargetRef(targetRef);
            request.setReason(reason);
            request.setResult(result);
            request.setSuccess(true);
            operationAuditService.write(request);
        } catch (RuntimeException e) {
            log.warn("Failed to write console operation audit action={}: {}", action, e.getMessage());
        }
    }
}
