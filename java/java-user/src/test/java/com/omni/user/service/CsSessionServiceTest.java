package com.omni.user.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.exception.BusinessException;
import com.omni.user.dto.CsAuditRequest;
import com.omni.user.dto.CsOrgTreeResponse;
import com.omni.user.dto.CsUserSessionHistoryResponse;
import com.omni.user.dto.CsSessionResponse;
import com.omni.user.dto.CsSessionQuery;
import com.omni.user.dto.CsTransferRequest;
import com.omni.user.entity.CsAgentMember;
import com.omni.user.entity.CsSkillGroup;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.User;
import com.omni.user.mapper.CsAgentMemberMapper;
import com.omni.user.mapper.CsSessionAuditMapper;
import com.omni.user.mapper.CsSkillGroupMapper;
import com.omni.user.mapper.SupportConversationAuditMapper;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportConversationNoteMapper;
import com.omni.user.mapper.SupportMessageMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CsSessionServiceTest {

    private final CsSkillGroupMapper groupMapper = mock(CsSkillGroupMapper.class);
    private final CsAgentMemberMapper memberMapper = mock(CsAgentMemberMapper.class);
    private final CsSessionAuditMapper sessionAuditMapper = mock(CsSessionAuditMapper.class);
    private final SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
    private final SupportMessageMapper messageMapper = mock(SupportMessageMapper.class);
    private final SupportConversationAuditMapper conversationAuditMapper = mock(SupportConversationAuditMapper.class);
    private final SupportConversationNoteMapper noteMapper = mock(SupportConversationNoteMapper.class);
    private final SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OperationAuditService operationAuditService = mock(OperationAuditService.class);

    @Test
    void aggregatesPublicPoolGroupsAndAgentCountsInOrgTree() {
        CsSessionService service = service();
        User manager = user(1L, "support");
        when(userMapper.selectById(1L)).thenReturn(manager);
        when(rbacService.getInternalAuthContext(1L)).thenReturn(auth(1L, "support_manager", List.of("cs.manage")));

        CsSkillGroup ticket = group(10L, "TICKET_REFUND", "票务退改与咨询组", 1L);
        CsSkillGroup dispute = group(20L, "DISPUTE_COMPLAINT", "演出纠纷与客诉二线组", null);
        when(groupMapper.selectList(any())).thenReturn(List.of(ticket, dispute));
        when(memberMapper.selectList(any())).thenReturn(List.of(
                member(101L, 10L, "小周", 1),
                member(102L, 10L, "小林", 2)
        ));
        when(conversationMapper.selectList(any())).thenReturn(List.of(
                conversation(1L, 1001L, "WAITING_AGENT", null, 10L, true),
                conversation(2L, 1002L, "ASSIGNED", 101L, 10L, false),
                conversation(3L, 1003L, "CLOSED", 102L, 20L, false)
        ));

        CsOrgTreeResponse tree = service.getOrgTree(1L);

        assertEquals(2L, tree.getActiveCount());
        assertEquals(1L, tree.getPublicPoolCount());
        assertEquals(1L, tree.getPublicPoolTimeoutCount());
        assertEquals(2, tree.getGroups().size());
        assertEquals(2L, tree.getGroups().get(0).getActiveCount());
        assertEquals(1L, tree.getGroups().get(0).getAgents().get(0).getActiveSessionCount());
    }

    @Test
    void mapsClosedWithoutAuditToNeedAudit() {
        CsSessionService service = service();
        assertEquals("ACTIVE", service.mapStatus("OPEN", false));
        assertEquals("NEED_AUDIT", service.mapStatus("CLOSED", false));
        assertEquals("CLOSED", service.mapStatus("CLOSED", true));
    }

    @Test
    void ordinaryAgentCannotAudit() {
        CsSessionService service = service();
        when(userMapper.selectById(3L)).thenReturn(user(3L, "support"));
        when(rbacService.getInternalAuthContext(3L)).thenReturn(auth(3L, "support_agent", List.of("support.conversation.view")));

        assertThrows(BusinessException.class, () -> service.audit(3L, 11L, auditRequest(5)));
        verify(sessionAuditMapper, never()).insert(any());
    }

    @Test
    void managerAuditWritesQualityRecordAndOperationAudit() {
        CsSessionService service = service();
        when(userMapper.selectById(1L)).thenReturn(user(1L, "support"));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(auth(1L, "support_manager", List.of("cs.manage")));
        when(conversationMapper.selectById(11L)).thenReturn(conversation(11L, 1001L, "CLOSED", 3L, 10L, false));

        service.audit(1L, 11L, auditRequest(4));

        verify(sessionAuditMapper).insert(argThat(row ->
                row.getSessionId().equals(11L)
                        && row.getAuditorUserId().equals(1L)
                        && row.getScore().equals(4)
        ));
        verify(operationAuditService).write(argThat((OperationAuditWriteRequest request) ->
                "CS_SESSION_QUALITY_AUDIT".equals(request.getAction())
                        && "cs_session".equals(request.getTargetType())
                        && Long.valueOf(11L).equals(request.getTargetId())
        ));
    }

    @Test
    void transferRequiresNonBlankNote() {
        CsSessionService service = service();
        when(userMapper.selectById(1L)).thenReturn(user(1L, "support"));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(auth(1L, "support_manager", List.of("cs.manage")));

        CsTransferRequest request = new CsTransferRequest();
        request.setTargetGroupId(20L);
        request.setTargetAgentId(201L);
        request.setTransferNote("  ");

        assertThrows(BusinessException.class, () -> service.transfer(1L, 11L, request));
        verify(conversationMapper, never()).updateById(any());
    }

    @Test
    void reviewerOnlySeesUnAuditedClosedSessions() {
        CsSessionService service = service();
        when(userMapper.selectById(4L)).thenReturn(user(4L, "support"));
        when(rbacService.getInternalAuthContext(4L)).thenReturn(auth(4L, "support_agent", List.of("cs.review")));
        when(groupMapper.selectList(any())).thenReturn(List.of());
        when(memberMapper.selectList(any())).thenReturn(List.of());
        when(conversationMapper.selectList(any())).thenReturn(List.of(
                conversation(21L, 2001L, "ASSIGNED", 101L, 10L, false),
                conversation(22L, 2002L, "CLOSED", 101L, 10L, false)
        ));
        when(sessionAuditMapper.selectList(any())).thenReturn(List.of());

        CsOrgTreeResponse tree = service.getOrgTree(4L);

        assertEquals(0L, tree.getActiveCount());
        assertEquals(0L, tree.getPublicPoolCount());
    }

    @Test
    void orgTreeReturnsActiveAndClosedCountsForVisibleScope() {
        CsSessionService service = service();
        when(userMapper.selectById(1L)).thenReturn(user(1L, "support"));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(auth(1L, "support_manager", List.of("cs.manage")));
        when(groupMapper.selectList(any())).thenReturn(List.of(
                group(10L, "TICKET_REFUND", "票务退改与咨询组", 1L),
                group(20L, "DISPUTE_COMPLAINT", "演出纠纷与客诉二线组", null)
        ));
        when(memberMapper.selectList(any())).thenReturn(List.of(
                member(101L, 10L, "小周", 1),
                member(102L, 10L, "小林", 1)
        ));
        when(conversationMapper.selectList(any())).thenReturn(List.of(
                conversation(31L, 3001L, "ASSIGNED", 101L, 10L, false),
                conversation(32L, 3002L, "WAITING_AGENT", null, 10L, false),
                conversation(33L, 3003L, "CLOSED", 101L, 10L, false),
                conversation(34L, 3004L, "CLOSED", 102L, 10L, false),
                conversation(35L, 3005L, "CLOSED", null, null, false)
        ));

        CsOrgTreeResponse tree = service.getOrgTree(1L);

        assertEquals(2L, tree.getActiveCount());
        assertEquals(3L, tree.getTotalCount());
        assertEquals(2L, tree.getGroups().get(0).getActiveCount());
        assertEquals(2L, tree.getGroups().get(0).getTotalCount());
        assertEquals(1L, tree.getGroups().get(0).getAgents().get(0).getActiveSessionCount());
        assertEquals(1L, tree.getGroups().get(0).getAgents().get(0).getTotalCount());
    }

    @Test
    void userHistoryAppliesTheSameVisibleScopeAndReturnsNewestFirst() {
        CsSessionService service = service();
        when(userMapper.selectById(3L)).thenReturn(user(3L, "support"));
        when(rbacService.getInternalAuthContext(3L)).thenReturn(auth(3L, "support_agent", List.of("support.conversation.view")));
        SupportConversation ownClosed = conversation(41L, 9001L, "CLOSED", 3L, 10L, false);
        ownClosed.setCreateTime(LocalDateTime.of(2026, 9, 2, 10, 0));
        ownClosed.setClosedAt(LocalDateTime.of(2026, 9, 2, 10, 30));
        ownClosed.setCloseRequestReason("已完成退票");
        SupportConversation ownOlder = conversation(42L, 9001L, "CLOSED", 3L, 10L, false);
        ownOlder.setCreateTime(LocalDateTime.of(2026, 9, 1, 10, 0));
        SupportConversation otherAgent = conversation(43L, 9001L, "CLOSED", 8L, 10L, false);
        otherAgent.setCreateTime(LocalDateTime.of(2026, 9, 3, 10, 0));
        when(conversationMapper.selectList(any())).thenReturn(List.of(otherAgent, ownOlder, ownClosed));

        List<CsUserSessionHistoryResponse> history = service.listUserSessionHistory(3L, 9001L);

        assertEquals(2, history.size());
        assertEquals(41L, history.get(0).getSessionId());
        assertEquals("客服3", history.get(0).getAgentName());
        assertEquals("已完成退票", history.get(0).getCloseReason());
        assertEquals("CLOSED", history.get(0).getStatus());
    }

    @Test
    void sessionListAddsServerSidePoolAndSourceFilters() {
        CsSessionService service = service();
        when(userMapper.selectById(1L)).thenReturn(user(1L, "support"));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(auth(1L, "platform_super_admin", List.of()));
        when(conversationMapper.selectPage(any(), any())).thenReturn(new Page<>(1, 30));

        CsSessionQuery query = new CsSessionQuery();
        query.setStatus("ACTIVE");
        query.setUnassignedOnly(true);
        query.setSourceType("AI");

        service.listSessions(1L, query);

        verify(conversationMapper).selectPage(any(), any());
        assertEquals(Boolean.TRUE, query.getUnassignedOnly());
        assertEquals("AI", query.getSourceType());
    }

    @Test
    void teamLeaderTreeCountsOnlyLeaderOwnedGroups() {
        CsSessionService service = service();
        when(userMapper.selectById(6L)).thenReturn(user(6L, "support"));
        when(rbacService.getInternalAuthContext(6L)).thenReturn(auth(6L, "support_manager", List.of()));
        when(groupMapper.selectList(any()))
                .thenReturn(List.of(group(60L, "TICKET_REFUND", "票务退改与咨询组", 6L)))
                .thenReturn(List.of(
                        group(60L, "TICKET_REFUND", "票务退改与咨询组", 6L),
                        group(70L, "DISPUTE_COMPLAINT", "演出纠纷与客诉二线组", 8L)
                ));
        when(memberMapper.selectList(any())).thenReturn(List.of());
        when(conversationMapper.selectList(any())).thenReturn(List.of(
                conversation(61L, 6001L, "ASSIGNED", 601L, 60L, false),
                conversation(62L, 6002L, "CLOSED", 602L, 70L, false),
                conversation(63L, 6003L, "CLOSED", null, null, false)
        ));

        CsOrgTreeResponse tree = service.getOrgTree(6L);

        assertEquals(1L, tree.getActiveCount());
        assertEquals(0L, tree.getTotalCount());
        assertEquals(1, tree.getGroups().size());
        assertEquals(60L, tree.getGroups().get(0).getId());
    }

    private CsSessionService service() {
        return new CsSessionService(
                groupMapper, memberMapper, sessionAuditMapper, conversationMapper,
                messageMapper, conversationAuditMapper, noteMapper, supportAccountMapper,
                userMapper, rbacService, operationAuditService
        );
    }

    private static InternalAuthContextResponse auth(Long userId, String role, List<String> permissions) {
        InternalAuthContextResponse response = new InternalAuthContextResponse();
        response.setUserId(userId);
        response.setEffectiveRole(role);
        response.setPermissionCodes(permissions);
        return response;
    }

    private static User user(Long id, String role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(1);
        user.setNickname("客服" + id);
        return user;
    }

    private static CsSkillGroup group(Long id, String code, String name, Long leaderId) {
        CsSkillGroup group = new CsSkillGroup();
        group.setId(id);
        group.setGroupCode(code);
        group.setGroupName(name);
        group.setLeaderUserId(leaderId);
        group.setStatus(1);
        return group;
    }

    private static CsAgentMember member(Long id, Long groupId, String name, int status) {
        CsAgentMember member = new CsAgentMember();
        member.setId(id);
        member.setGroupId(groupId);
        member.setUserId(id);
        member.setAgentName(name);
        member.setAgentStatus(status);
        return member;
    }

    private static SupportConversation conversation(Long id, Long userId, String status, Long agentId, Long groupId, boolean overdue) {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(id);
        conversation.setUserId(userId);
        conversation.setStatus(status);
        conversation.setAssignedAgentId(agentId);
        conversation.setSkillGroupId(groupId);
        conversation.setSlaTimeoutFlag(overdue);
        conversation.setSubject("客服咨询");
        conversation.setLastMessage("最后消息");
        conversation.setUpdateTime(LocalDateTime.now());
        return conversation;
    }

    private static CsAuditRequest auditRequest(int score) {
        CsAuditRequest request = new CsAuditRequest();
        request.setScore(score);
        request.setComments("已解决");
        request.setIsResolved(true);
        return request;
    }
}
