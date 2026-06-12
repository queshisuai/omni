package com.omni.user.controller;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.util.JwtUtil;
import com.omni.user.dto.RbacRolePermissionUpdateRequest;
import com.omni.user.service.ExceptionWorkbenchService;
import com.omni.user.service.OrganizerAdminAccountService;
import com.omni.user.service.OrganizerOpsService;
import com.omni.user.service.OperationAuditService;
import com.omni.user.service.PlatformOpsSummaryService;
import com.omni.user.service.RbacAdminService;
import com.omni.user.service.RbacService;
import com.omni.user.service.ReconciliationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InternalWorkbenchControllerRbacAuditTest {

    private final ExceptionWorkbenchService exceptionWorkbenchService = mock(ExceptionWorkbenchService.class);
    private final ReconciliationService reconciliationService = mock(ReconciliationService.class);
    private final RbacAdminService rbacAdminService = mock(RbacAdminService.class);
    private final OrganizerAdminAccountService organizerAdminAccountService = mock(OrganizerAdminAccountService.class);
    private final OperationAuditService operationAuditService = mock(OperationAuditService.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OrganizerOpsService organizerOpsService = mock(OrganizerOpsService.class);
    private final PlatformOpsSummaryService platformOpsSummaryService = mock(PlatformOpsSummaryService.class);
    private final InternalWorkbenchController controller = new InternalWorkbenchController(
            exceptionWorkbenchService,
            reconciliationService,
            rbacAdminService,
            organizerAdminAccountService,
            operationAuditService,
            rbacService,
            organizerOpsService,
            platformOpsSummaryService
    );

    @Test
    void writesPermissionDiffSummaryToAuditLog() {
        RbacRolePermissionUpdateRequest request = new RbacRolePermissionUpdateRequest();
        request.setPermissionCodes(List.of("support.conversation.view", "support.account.manage"));
        RbacAdminService.RolePermissionUpdateResult updateResult = new RbacAdminService.RolePermissionUpdateResult(
                "support_manager",
                List.of("audit.view", "support.conversation.view"),
                List.of("support.conversation.view", "support.account.manage"),
                List.of(new RbacAdminService.PermissionChangeItem("support.account.manage", "客服账号管理")),
                List.of(new RbacAdminService.PermissionChangeItem("audit.view", "操作审计"))
        );
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("platform_super_admin", "rbac.manage"));
        when(rbacAdminService.updateRolePermissions("support_manager", request.getPermissionCodes())).thenReturn(updateResult);

        var result = controller.updateRolePermissions(bearer(2002L), "support_manager", request);

        assertEquals(200, result.getCode());
        ArgumentCaptor<OperationAuditWriteRequest> captor = ArgumentCaptor.forClass(OperationAuditWriteRequest.class);
        verify(operationAuditService).write(captor.capture());
        OperationAuditWriteRequest audit = captor.getValue();
        assertEquals("rbac.role_permission.update", audit.getAction());
        assertEquals("rbac_role", audit.getTargetType());
        assertEquals("support_manager", audit.getTargetRef());
        assertEquals("新增权限：客服账号管理（support.account.manage）；移除权限：操作审计（audit.view）；更新后权限数：2",
                audit.getResult());
    }

    private String bearer(Long userId) {
        return "Bearer " + JwtUtil.generateToken(userId, "13800000001", "admin");
    }

    private InternalAuthContextResponse auth(String role, String... permissions) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setEffectiveRole(role);
        auth.setPermissionCodes(List.of(permissions));
        return auth;
    }
}
