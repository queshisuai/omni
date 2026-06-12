package com.omni.user.controller;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerOpsAssignmentRequest;
import com.omni.user.dto.OrganizerOpsAssignmentResponse;
import com.omni.user.dto.OrganizerOpsFollowUpRequest;
import com.omni.user.dto.OrganizerOpsFollowUpResponse;
import com.omni.user.service.ExceptionWorkbenchService;
import com.omni.user.service.OrganizerAdminAccountService;
import com.omni.user.service.OrganizerOpsService;
import com.omni.user.service.OperationAuditService;
import com.omni.user.service.PlatformOpsSummaryService;
import com.omni.user.service.RbacAdminService;
import com.omni.user.service.RbacService;
import com.omni.user.service.ReconciliationService;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InternalWorkbenchControllerOrganizerOpsTest {

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
    void listAssignmentsRequiresOrganizerReviewOrFollowPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.review"));
        OrganizerOpsAssignmentResponse assignment = assignmentResponse(3003L, 2003L, "watch", "pending_material");
        when(organizerOpsService.listAssignments(2003L)).thenReturn(List.of(assignment));

        var result = controller.listOrganizerOpsAssignments(bearer(2003L));

        assertEquals(200, result.getCode());
        assertEquals(1, result.getData().size());
        assertEquals(3003L, result.getData().get(0).getOrganizerUserId());
    }

    @Test
    void listAssignmentsRejectsMissingToken() {
        var result = controller.listOrganizerOpsAssignments(null);

        assertEquals(401, result.getCode());
        assertNull(result.getData());
        verify(organizerOpsService, never()).listAssignments(2003L);
    }

    @Test
    void updateAssignmentRequiresAssignPermission() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("platform_super_admin", "organizer.assign.manage"));
        LocalDateTime nextFollowAt = LocalDateTime.of(2026, 6, 11, 9, 0);
        OrganizerOpsAssignmentRequest request = new OrganizerOpsAssignmentRequest();
        request.setAssignedOperatorId(2003L);
        request.setRiskLevel("watch");
        request.setStatus("pending_material");
        request.setNextFollowAt(nextFollowAt);
        when(organizerOpsService.updateAssignment(2002L, 3003L, request))
                .thenReturn(assignmentResponse(3003L, 2003L, "watch", "pending_material"));

        var result = controller.updateOrganizerOpsAssignment(bearer(2002L), 3003L, request);

        assertEquals(200, result.getCode());
        assertEquals(2003L, result.getData().getAssignedOperatorId());
        verify(organizerOpsService).updateAssignment(2002L, 3003L, request);
    }

    @Test
    void updateAssignmentRejectsOperatorWithoutAssignPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.follow.manage"));
        OrganizerOpsAssignmentRequest request = new OrganizerOpsAssignmentRequest();

        BusinessException error = assertThrows(BusinessException.class,
                () -> controller.updateOrganizerOpsAssignment(bearer(2003L), 3003L, request));

        assertEquals(403, error.getCode());
        assertEquals("无权限", error.getMessage());
        verify(organizerOpsService, never()).updateAssignment(2003L, 3003L, request);
    }

    @Test
    void listFollowUpsRequiresOrganizerReviewOrFollowPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.follow.manage"));
        OrganizerOpsFollowUpResponse followUp = followUpResponse(9L, 3003L, 2003L, "CALL");
        when(organizerOpsService.listFollowUps(2003L, 3003L)).thenReturn(List.of(followUp));

        var result = controller.listOrganizerOpsFollowUps(bearer(2003L), 3003L);

        assertEquals(200, result.getCode());
        assertEquals(9L, result.getData().get(0).getId());
        assertEquals("CALL", result.getData().get(0).getFollowType());
    }

    @Test
    void createFollowUpRequiresFollowPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.follow.manage"));
        OrganizerOpsFollowUpRequest request = new OrganizerOpsFollowUpRequest();
        request.setFollowType("CALL");
        request.setContent("已电话确认需要补充场馆授权材料");
        when(organizerOpsService.createFollowUp(2003L, 3003L, request))
                .thenReturn(followUpResponse(9L, 3003L, 2003L, "CALL"));

        var result = controller.createOrganizerOpsFollowUp(bearer(2003L), 3003L, request);

        assertEquals(200, result.getCode());
        assertEquals(3003L, result.getData().getOrganizerUserId());
        verify(organizerOpsService).createFollowUp(2003L, 3003L, request);
    }

    @Test
    void createFollowUpRejectsOperatorWithoutFollowPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.review"));
        OrganizerOpsFollowUpRequest request = new OrganizerOpsFollowUpRequest();

        BusinessException error = assertThrows(BusinessException.class,
                () -> controller.createOrganizerOpsFollowUp(bearer(2003L), 3003L, request));

        assertEquals(403, error.getCode());
        assertEquals("无权限", error.getMessage());
        verify(organizerOpsService, never()).createFollowUp(2003L, 3003L, request);
    }

    private String bearer(Long userId) {
        return "Bearer " + JwtUtil.generateToken(userId, "13900000001", "admin");
    }

    private InternalAuthContextResponse auth(String role, String... permissions) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setEffectiveRole(role);
        auth.setPermissionCodes(List.of(permissions));
        return auth;
    }

    private OrganizerOpsAssignmentResponse assignmentResponse(Long organizerUserId, Long assignedOperatorId,
                                                              String riskLevel, String status) {
        OrganizerOpsAssignmentResponse response = new OrganizerOpsAssignmentResponse();
        response.setOrganizerUserId(organizerUserId);
        response.setAssignedOperatorId(assignedOperatorId);
        response.setRiskLevel(riskLevel);
        response.setStatus(status);
        return response;
    }

    private OrganizerOpsFollowUpResponse followUpResponse(Long id, Long organizerUserId, Long operatorId, String followType) {
        OrganizerOpsFollowUpResponse response = new OrganizerOpsFollowUpResponse();
        response.setId(id);
        response.setOrganizerUserId(organizerUserId);
        response.setOperatorId(operatorId);
        response.setFollowType(followType);
        response.setContent("已电话确认需要补充场馆授权材料");
        response.setCreateTime(LocalDateTime.of(2026, 6, 8, 9, 0));
        return response;
    }
}
