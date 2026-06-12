package com.omni.user.controller;

import com.omni.common.dto.ExceptionTaskActionRequest;
import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchDetailResponse;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.dto.ReconciliationDifferenceResponse;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerAdminAccountRequest;
import com.omni.user.dto.OrganizerAdminAccountResponse;
import com.omni.user.dto.OrganizerOpsAssignmentRequest;
import com.omni.user.dto.OrganizerOpsAssignmentResponse;
import com.omni.user.dto.OrganizerOpsFollowUpRequest;
import com.omni.user.dto.OrganizerOpsFollowUpResponse;
import com.omni.user.dto.OperationAuditLogResponse;
import com.omni.user.dto.RbacPermissionResponse;
import com.omni.user.dto.RbacRolePermissionUpdateRequest;
import com.omni.user.dto.RbacRoleResponse;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import com.omni.user.service.OrganizerAdminAccountService;
import com.omni.user.service.OrganizerOpsService;
import com.omni.user.service.OperationAuditService;
import com.omni.user.service.PlatformOpsSummaryService;
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
    private final OrganizerOpsService organizerOpsService;
    private final PlatformOpsSummaryService platformOpsSummaryService;

    public InternalWorkbenchController(ExceptionWorkbenchService exceptionWorkbenchService,
                                       ReconciliationService reconciliationService,
                                       RbacAdminService rbacAdminService,
                                       OrganizerAdminAccountService organizerAdminAccountService,
                                       OperationAuditService operationAuditService,
                                       RbacService rbacService,
                                       OrganizerOpsService organizerOpsService,
                                       PlatformOpsSummaryService platformOpsSummaryService) {
        this.exceptionWorkbenchService = exceptionWorkbenchService;
        this.reconciliationService = reconciliationService;
        this.rbacAdminService = rbacAdminService;
        this.organizerAdminAccountService = organizerAdminAccountService;
        this.operationAuditService = operationAuditService;
        this.rbacService = rbacService;
        this.organizerOpsService = organizerOpsService;
        this.platformOpsSummaryService = platformOpsSummaryService;
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
        RbacAdminService.RolePermissionUpdateResult updateResult =
                rbacAdminService.updateRolePermissions(roleCode, request == null ? null : request.getPermissionCodes());
        auditSuccess(userId, "rbac.role_permission.update", "rbac_role", null, roleCode,
                "更新角色授权", updateResult.toAuditSummary());
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
                "创建平台主办方运营员账号", "创建成功");
        return Result.success(response);
    }

    @PutMapping("/organizer-admins/{id}")
    public Result<OrganizerAdminAccountResponse> updateOrganizerAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody OrganizerAdminAccountRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        OrganizerAdminAccountResponse response = organizerAdminAccountService.update(id, request);
        auditSuccess(userId, "organizer_admin.update", "user", response.getId(), response.getPhone(),
                "更新平台主办方运营员账号", "更新成功");
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
                "停用平台主办方运营员账号", "停用成功");
        return Result.success(response);
    }

    @DeleteMapping("/organizer-admins/{id}")
    public Result<OrganizerAdminAccountResponse> deleteOrganizerAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.account.manage");
        OrganizerAdminAccountResponse response = organizerAdminAccountService.delete(id);
        auditSuccess(userId, "organizer_admin.delete", "user", response.getId(), response.getPhone(),
                "删除平台主办方运营员账号", "删除成功");
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

    @GetMapping("/ops-summary")
    public Result<PlatformOpsSummaryResponse> getPlatformOpsSummary(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        requirePermission(userId, "reconcile.view");
        requirePermission(userId, "audit.view");
        return Result.success(platformOpsSummaryService.load(authorization));
    }

    @GetMapping("/organizer-ops/assignments")
    public Result<java.util.List<OrganizerOpsAssignmentResponse>> listOrganizerOpsAssignments(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requireAnyPermission(userId, "organizer.review", "organizer.follow.manage");
        return Result.success(organizerOpsService.listAssignments(userId));
    }

    @PutMapping("/organizer-ops/assignments/{organizerUserId}")
    public Result<OrganizerOpsAssignmentResponse> updateOrganizerOpsAssignment(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long organizerUserId,
            @RequestBody OrganizerOpsAssignmentRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.assign.manage");
        return Result.success(organizerOpsService.updateAssignment(userId, organizerUserId, request));
    }

    @GetMapping("/organizer-ops/assignments/{organizerUserId}/follow-ups")
    public Result<java.util.List<OrganizerOpsFollowUpResponse>> listOrganizerOpsFollowUps(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long organizerUserId) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requireAnyPermission(userId, "organizer.review", "organizer.follow.manage");
        return Result.success(organizerOpsService.listFollowUps(userId, organizerUserId));
    }

    @PostMapping("/organizer-ops/assignments/{organizerUserId}/follow-ups")
    public Result<OrganizerOpsFollowUpResponse> createOrganizerOpsFollowUp(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long organizerUserId,
            @RequestBody OrganizerOpsFollowUpRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "organizer.follow.manage");
        return Result.success(organizerOpsService.createFollowUp(userId, organizerUserId, request));
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

    @PostMapping("/exception-tasks/{taskId}/claim")
    public Result<ExceptionTaskResponse> claimExceptionTask(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long taskId) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        ExceptionTaskResponse response = exceptionWorkbenchService.claim(taskId, userId, resolveOperatorRole(userId));
        auditSuccess(userId, "exception_task.claim", "exception_task", response.getId(), response.getBusinessNo(),
                "认领异常任务", "认领成功");
        return Result.success(response);
    }

    @PostMapping("/exception-tasks/{taskId}/resolve")
    public Result<ExceptionTaskResponse> resolveExceptionTask(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long taskId,
            @RequestBody(required = false) ExceptionTaskActionRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        String result = request == null ? null : request.getResult();
        ExceptionTaskResponse response = exceptionWorkbenchService.resolve(taskId, result, userId, resolveOperatorRole(userId));
        auditSuccess(userId, "exception_task.resolve", "exception_task", response.getId(), response.getBusinessNo(),
                "处理异常任务", response.getResult());
        return Result.success(response);
    }

    @PostMapping("/exception-tasks/{taskId}/close")
    public Result<ExceptionTaskResponse> closeExceptionTask(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long taskId,
            @RequestBody(required = false) ExceptionTaskActionRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "compensation.execute");
        String result = request == null ? null : request.getResult();
        ExceptionTaskResponse response = exceptionWorkbenchService.close(taskId, result, userId, resolveOperatorRole(userId));
        auditSuccess(userId, "exception_task.close", "exception_task", response.getId(), response.getBusinessNo(),
                "关闭异常任务", response.getResult());
        return Result.success(response);
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

    @GetMapping("/reconciliation/batches/{batchNo}")
    public Result<ReconciliationBatchDetailResponse> getBatchDetail(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String batchNo) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "reconcile.view");
        return Result.success(reconciliationService.getBatchDetail(batchNo));
    }

    @PostMapping("/reconciliation/batches/{batchNo}/differences/{differenceId}/resolve")
    public Result<ReconciliationDifferenceResponse> resolveReconciliationDifference(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String batchNo,
            @PathVariable Long differenceId) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "reconcile.view");
        ReconciliationDifferenceResponse response = reconciliationService.resolveDifference(batchNo, differenceId);
        auditSuccess(userId, "reconciliation_difference.resolve", "reconciliation_difference", response.getId(), batchNo,
                "处理对账差异", "差异已处理");
        return Result.success(response);
    }

    @PostMapping("/reconciliation/batches/{batchNo}/differences/{differenceId}/ignore")
    public Result<ReconciliationDifferenceResponse> ignoreReconciliationDifference(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String batchNo,
            @PathVariable Long differenceId) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        requirePermission(userId, "reconcile.view");
        ReconciliationDifferenceResponse response = reconciliationService.ignoreDifference(batchNo, differenceId);
        auditSuccess(userId, "reconciliation_difference.ignore", "reconciliation_difference", response.getId(), batchNo,
                "忽略对账差异", "差异已忽略");
        return Result.success(response);
    }

    private void requirePermission(Long userId, String permissionCode) {
        if (!rbacService.getInternalAuthContext(userId).getPermissionCodes().contains(permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }

    private void requireAnyPermission(Long userId, String... permissionCodes) {
        java.util.List<String> currentPermissions = rbacService.getInternalAuthContext(userId).getPermissionCodes();
        if (currentPermissions != null) {
            for (String permissionCode : permissionCodes) {
                if (currentPermissions.contains(permissionCode)) {
                    return;
                }
            }
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
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

    private String resolveOperatorRole(Long userId) {
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(userId);
        if (auth == null || !StringUtils.hasText(auth.getEffectiveRole())) {
            return "unknown";
        }
        return auth.getEffectiveRole();
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
