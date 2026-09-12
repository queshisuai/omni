package com.omni.user.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.OrganizerOpsAssignment;
import com.omni.user.entity.User;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.OrganizerOpsAssignmentMapper;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrganizerDirectoryServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final OrganizerApplicationMapper applicationMapper = mock(OrganizerApplicationMapper.class);
    private final OrganizerOpsAssignmentMapper assignmentMapper = mock(OrganizerOpsAssignmentMapper.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OperationAuditService auditService = mock(OperationAuditService.class);
    private final OrganizerDirectoryService service = new OrganizerDirectoryService(
            userMapper, applicationMapper, assignmentMapper, rbacService, auditService);

    @Test
    void listReturnsLatestApprovedQualificationAndAssignedOperator() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("organizer.review"));
        when(userMapper.selectPage(any(), any())).thenReturn(pageOf(organizer(2003L, "星河演艺集团", 1)));
        when(applicationMapper.selectList(any())).thenReturn(List.of(
                approvedApplication(21L, 2003L, "91110000XINGHE")));
        when(assignmentMapper.selectList(any())).thenReturn(List.of(assignment(2003L, 2002L)));
        when(userMapper.selectBatchIds(any())).thenReturn(List.of(operator(2002L, "平台运营员")));

        Page<com.omni.user.dto.OrganizerDirectoryResponse> result =
                service.list(2002L, 1, 10, "星河", null, "ACTIVE");

        assertEquals("91110000XINGHE", result.getRecords().get(0).getQualificationNo());
        assertEquals("平台运营员", result.getRecords().get(0).getFollowUpOperatorName());
    }

    @Test
    void listFiltersFollowUpOperatorBeforePagination() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("organizer.review"));
        when(userMapper.selectList(any())).thenReturn(List.of(operator(2002L, "平台运营员")));
        when(assignmentMapper.selectList(any())).thenReturn(List.of(assignment(2003L, 2002L)));
        when(userMapper.selectPage(any(), any())).thenReturn(pageOf(organizer(2003L, "星河演艺集团", 1)));
        when(applicationMapper.selectList(any())).thenReturn(List.of(
                approvedApplication(21L, 2003L, "91110000XINGHE")));
        when(userMapper.selectBatchIds(any())).thenReturn(List.of(operator(2002L, "平台运营员")));

        Page<com.omni.user.dto.OrganizerDirectoryResponse> result =
                service.list(2002L, 1, 10, null, "平台运营", "ACTIVE");

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRecords().size());
        verify(userMapper).selectPage(any(), any());
    }

    @Test
    void listReturnsEmptyPageWhenFollowUpOperatorDoesNotMatch() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("organizer.review"));
        when(userMapper.selectList(any())).thenReturn(List.of());

        Page<com.omni.user.dto.OrganizerDirectoryResponse> result =
                service.list(2002L, 1, 10, null, "不存在的运营员", "ACTIVE");

        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
        verify(userMapper, never()).selectPage(any(), any());
    }

    @Test
    void revokeRequiresReasonAndWritesAudit() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("organizer.account.manage"));
        when(userMapper.selectById(2003L)).thenReturn(organizer(2003L, "星河演艺集团", 1));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.revoke(2002L, 2003L, "  "));

        assertEquals("取消合作/冻结原因不能为空", error.getMessage());
        verify(userMapper, never()).updateById(any());
        verifyNoInteractions(auditService);
    }

    @Test
    void revokeChangesOrganizerStatusAndWritesAudit() {
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(auth("organizer.review"));
        User user = organizer(2003L, "星河演艺集团", 1);
        when(userMapper.selectById(2003L)).thenReturn(user);

        service.revoke(2002L, 2003L, "合作暂停");

        assertEquals("user", user.getRole());
        assertEquals(3, user.getOrganizerStatus());
        verify(userMapper).updateById(user);
        verify(auditService).write(any());
    }

    private Page<User> pageOf(User user) {
        Page<User> page = new Page<>(1, 10);
        page.setTotal(1);
        page.setRecords(List.of(user));
        return page;
    }

    private User organizer(Long id, String name, int status) {
        User user = new User();
        user.setId(id);
        user.setOrganizerName(name);
        user.setRole(status == 1 ? "organizer" : "user");
        user.setOrganizerStatus(status);
        user.setPhone("13800000003");
        return user;
    }

    private User operator(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setNickname(name);
        user.setRole("organizer_admin");
        return user;
    }

    private OrganizerApplication approvedApplication(Long id, Long userId, String licenseNo) {
        OrganizerApplication application = new OrganizerApplication();
        application.setId(id);
        application.setUserId(userId);
        application.setStatus(1);
        application.setLicenseNo(licenseNo);
        application.setSubjectType("enterprise");
        return application;
    }

    private OrganizerOpsAssignment assignment(Long organizerId, Long operatorId) {
        OrganizerOpsAssignment assignment = new OrganizerOpsAssignment();
        assignment.setOrganizerUserId(organizerId);
        assignment.setAssignedOperatorId(operatorId);
        return assignment;
    }

    private com.omni.common.dto.InternalAuthContextResponse auth(String permission) {
        com.omni.common.dto.InternalAuthContextResponse auth = new com.omni.common.dto.InternalAuthContextResponse();
        auth.setPermissionCodes(List.of(permission));
        auth.setScopeType("platform");
        return auth;
    }
}
