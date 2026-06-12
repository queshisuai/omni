package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.exception.BusinessException;
import com.omni.user.entity.OrganizerOpsAssignment;
import com.omni.user.entity.OrganizerOpsFollowUp;
import com.omni.user.mapper.OrganizerOpsAssignmentMapper;
import com.omni.user.mapper.OrganizerOpsFollowUpMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizerOpsServiceTest {

    private final OrganizerOpsAssignmentMapper assignmentMapper = mock(OrganizerOpsAssignmentMapper.class);
    private final OrganizerOpsFollowUpMapper followUpMapper = mock(OrganizerOpsFollowUpMapper.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OperationAuditService auditService = mock(OperationAuditService.class);
    private final OrganizerOpsService service = new OrganizerOpsService(
            assignmentMapper,
            followUpMapper,
            rbacService,
            auditService
    );

    @Test
    void operatorCreatesFollowUpAndSetsNextFollowAt() {
        LocalDateTime nextFollowAt = LocalDateTime.of(2026, 6, 10, 10, 30);
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.follow.manage"));
        when(assignmentMapper.selectById(3003L)).thenReturn(assignment(3003L, 2003L, "normal", "active"));

        OrganizerOpsFollowUp response = service.createFollowUp(
                2003L,
                3003L,
                "CALL",
                "已电话确认需要补充场馆授权材料",
                nextFollowAt
        );

        assertEquals(3003L, response.getOrganizerUserId());
        assertEquals(2003L, response.getOperatorId());
        assertEquals("CALL", response.getFollowType());
        assertEquals(nextFollowAt, response.getNextFollowAt());
        verify(followUpMapper).insert(argThat(followUp ->
                Long.valueOf(3003L).equals(followUp.getOrganizerUserId())
                        && Long.valueOf(2003L).equals(followUp.getOperatorId())
                        && "CALL".equals(followUp.getFollowType())
                        && "已电话确认需要补充场馆授权材料".equals(followUp.getContent())
                        && nextFollowAt.equals(followUp.getNextFollowAt())
        ));
        verify(assignmentMapper).updateById(argThat(assignment ->
                Long.valueOf(3003L).equals(assignment.getOrganizerUserId())
                        && nextFollowAt.equals(assignment.getNextFollowAt())
                        && assignment.getLastFollowAt() != null
        ));
    }

    @Test
    void createFollowUpRejectsOperatorWithoutFollowPermission() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.review"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.createFollowUp(
                2003L,
                3003L,
                "CALL",
                "已电话确认需要补充场馆授权材料",
                null
        ));

        assertEquals(403, error.getCode());
        assertEquals("无权限", error.getMessage());
        verify(followUpMapper, never()).insert(any());
        verify(assignmentMapper, never()).insert(any());
        verify(assignmentMapper, never()).updateById(any());
    }

    @Test
    void assignmentUpdateCreatesRowAndWritesAudit() {
        LocalDateTime nextFollowAt = LocalDateTime.of(2026, 6, 11, 9, 0);
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("platform_super_admin", "organizer.assign.manage"));
        when(assignmentMapper.selectById(3003L)).thenReturn(null);

        OrganizerOpsAssignment response = service.updateAssignment(
                2002L,
                3003L,
                2003L,
                "watch",
                "pending_material",
                nextFollowAt
        );

        assertEquals(3003L, response.getOrganizerUserId());
        assertEquals(2003L, response.getAssignedOperatorId());
        assertEquals("watch", response.getRiskLevel());
        assertEquals("pending_material", response.getStatus());
        assertEquals(nextFollowAt, response.getNextFollowAt());
        verify(assignmentMapper).insert(argThat(assignment ->
                Long.valueOf(3003L).equals(assignment.getOrganizerUserId())
                        && Long.valueOf(2003L).equals(assignment.getAssignedOperatorId())
                        && "watch".equals(assignment.getRiskLevel())
                        && "pending_material".equals(assignment.getStatus())
        ));
        verify(auditService).write(argThat(request ->
                "organizer_ops.assignment.update".equals(request.getAction())
                        && "organizer_ops_assignment".equals(request.getTargetType())
                        && Long.valueOf(3003L).equals(request.getTargetId())
                        && "2003".equals(request.getTargetRef())
                        && Boolean.TRUE.equals(request.getSuccess())
        ));
    }

    @Test
    void followUpCreationCreatesDefaultAssignmentWhenMissing() {
        when(rbacService.getInternalAuthContext(2003L)).thenReturn(auth("organizer_admin", "organizer.follow.manage"));
        when(assignmentMapper.selectById(3003L)).thenReturn(null);

        OrganizerOpsFollowUp response = service.createFollowUp(
                2003L,
                3003L,
                "NOTE",
                "已补充资质，等待复核",
                null
        );

        assertNotNull(response.getCreateTime());
        verify(assignmentMapper).insert(argThat(assignment ->
                Long.valueOf(3003L).equals(assignment.getOrganizerUserId())
                        && Long.valueOf(2003L).equals(assignment.getAssignedOperatorId())
                        && "normal".equals(assignment.getRiskLevel())
                        && "active".equals(assignment.getStatus())
                        && assignment.getLastFollowAt() != null
        ));
    }

    private OrganizerOpsAssignment assignment(Long organizerUserId, Long operatorId, String riskLevel, String status) {
        OrganizerOpsAssignment assignment = new OrganizerOpsAssignment();
        assignment.setOrganizerUserId(organizerUserId);
        assignment.setAssignedOperatorId(operatorId);
        assignment.setRiskLevel(riskLevel);
        assignment.setStatus(status);
        return assignment;
    }

    private InternalAuthContextResponse auth(String role, String... permissions) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setEffectiveRole(role);
        auth.setPermissionCodes(List.of(permissions));
        return auth;
    }
}
