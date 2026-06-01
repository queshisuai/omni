package com.omni.user.service;

import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.exception.BusinessException;
import com.omni.user.client.NotificationInternalClient;
import com.omni.user.dto.SupportConversationRequest;
import com.omni.user.dto.SupportConversationResponse;
import com.omni.user.dto.SupportMessageRequest;
import com.omni.user.dto.SupportMessageResponse;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.SupportMessage;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportMessageMapper;
import com.omni.user.mapper.UserMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomerSupportServiceTest {

    @BeforeAll
    static void initMybatisPlusMetadata() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SupportConversation.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SupportMessage.class);
    }

    private final SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
    private final SupportMessageMapper messageMapper = mock(SupportMessageMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final NotificationInternalClient notificationClient = mock(NotificationInternalClient.class);
    private final CustomerSupportService service = new CustomerSupportService(
            conversationMapper,
            messageMapper,
            userMapper,
            new SupportAiService((question, projectKnowledge) -> java.util.Optional.empty()),
            notificationClient,
            "internal-token"
        );

    @Test
    void startsAiConversationAndPersistsUserAndAiMessages() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        when(conversationMapper.insert(any())).thenAnswer(invocation -> {
            SupportConversation conversation = invocation.getArgument(0);
            conversation.setId(99L);
            return 1;
        });

        SupportConversationRequest request = new SupportConversationRequest();
        request.setInitialMessage("电子票二维码在哪里？");

        SupportConversationResponse response = service.startConversation(10L, request);

        assertEquals(99L, response.getId());
        assertEquals("OPEN", response.getStatus());
        assertEquals("AI", response.getSourceType());
        verify(messageMapper, atLeastOnce()).insert(any(SupportMessage.class));
        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "AI".equals(message.getSenderType()) && message.getContent().contains("我的票夹")
        ));
    }

    @Test
    void userCannotReadOtherUsersConversation() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(20L);
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        BusinessException error = assertThrows(BusinessException.class, () -> service.listMessages(10L, 99L));

        assertEquals("无权查看该客服会话", error.getMessage());
    }

    @Test
    void supportAgentClaimsConversationAndCanReply() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        SupportConversationResponse claimed = service.claim(30L, 99L);
        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("您好，我来帮您继续处理。");
        service.sendMessage(30L, 99L, message);

        assertEquals("ASSIGNED", claimed.getStatus());
        assertEquals(30L, claimed.getAssignedAgentId());
        assertTrue("ASSIGNED".equals(conversation.getStatus()));
        assertTrue(conversation.getUpdateTime() != null);
        verify(conversationMapper, atLeastOnce()).updateById(conversation);
    }

    @Test
    void handoffWritesWaitingPromptVisibleToUser() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("OPEN");
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        service.handoff(10L, 99L);

        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "SYSTEM".equals(message.getSenderType())
                        && "人工介入请等待".equals(message.getContent())
        ));
    }

    @Test
    void claimWritesNamedAgentPromptVisibleToUser() {
        User agent = user(30L, "support");
        agent.setNickname("客服一号");
        when(userMapper.selectById(30L)).thenReturn(agent);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        service.claim(30L, 99L);

        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "SYSTEM".equals(message.getSenderType())
                        && "客服一号已介入".equals(message.getContent())
        ));
    }

    @Test
    void supportAgentCanOnlyRequestCloseUntilUserConfirms() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("ASSIGNED");
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        SupportConversationResponse response = service.close(30L, 99L);

        assertEquals("CLOSE_REQUESTED", response.getStatus());
        assertEquals(null, conversation.getClosedAt());
        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "SYSTEM".equals(message.getSenderType())
                        && "人工客服申请结束会话，请确认是否结束。".equals(message.getContent())
        ));
    }

    @Test
    void ownerConfirmsCloseBeforeConversationActuallyEnds() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("CLOSE_REQUESTED");
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        SupportConversationResponse response = service.confirmClose(10L, 99L);

        assertEquals("CLOSED", response.getStatus());
        assertTrue(conversation.getClosedAt() != null);
        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "SYSTEM".equals(message.getSenderType())
                        && "用户已确认结束会话".equals(message.getContent())
        ));
    }

    @Test
    void userReplyKeepsConversationOpenWhenCloseWasRequested() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("CLOSE_REQUESTED");
        conversation.setSourceType("HUMAN");
        conversation.setAssignedAgentId(30L);
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("我还需要继续咨询");

        service.sendMessage(10L, 99L, message);

        assertEquals("ASSIGNED", conversation.getStatus());
        verify(conversationMapper, atLeastOnce()).updateById(conversation);
    }

    @Test
    void conversationOwnerMessageIsUserEvenWhenOwnerHasAdminRole() {
        when(userMapper.selectById(10L)).thenReturn(user(10L, "admin"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("OPEN");
        conversation.setSourceType("HUMAN");
        conversation.setAssignedAgentId(30L);
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("我在用户端继续咨询");

        service.sendMessage(10L, 99L, message);

        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(inserted ->
                "USER".equals(inserted.getSenderType())
                        && Long.valueOf(10L).equals(inserted.getSenderUserId())
                        && "我在用户端继续咨询".equals(inserted.getContent())
        ));
    }

    @Test
    void messageResponseIncludesSenderDisplayName() {
        User customer = user(10L, "user");
        customer.setNickname("小王");
        when(userMapper.selectById(10L)).thenReturn(customer);
        User agent = user(30L, "support");
        agent.setNickname("杨梅");
        when(userMapper.selectById(30L)).thenReturn(agent);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("ASSIGNED");
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        SupportMessage message = new SupportMessage();
        message.setId(1L);
        message.setConversationId(99L);
        message.setSenderUserId(30L);
        message.setSenderType("AGENT");
        message.setContent("您好");
        when(messageMapper.selectList(any())).thenReturn(List.of(message));

        List<SupportMessageResponse> response = service.listMessages(10L, 99L);

        assertEquals("杨梅", response.get(0).getSenderDisplayName());
    }

    @Test
    void autoClosesAssignedHumanConversationWhenUserInactiveMoreThanThirtyMinutes() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 1, 17, 0);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("ASSIGNED");
        conversation.setSourceType("HUMAN");
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));
        SupportMessage lastUserMessage = new SupportMessage();
        lastUserMessage.setConversationId(99L);
        lastUserMessage.setSenderType("USER");
        lastUserMessage.setCreateTime(now.minusMinutes(31));
        when(messageMapper.selectOne(any())).thenReturn(lastUserMessage);

        int closedCount = service.closeInactiveAssignedHumanConversations(now);

        assertEquals(1, closedCount);
        assertEquals("CLOSED", conversation.getStatus());
        assertEquals(now, conversation.getClosedAt());
        assertEquals("用户超过30分钟未继续咨询，系统已自动结束会话。", conversation.getLastMessage());
        verify(conversationMapper).updateById(conversation);
        verify(messageMapper).insert(org.mockito.ArgumentMatchers.argThat(message ->
                "SYSTEM".equals(message.getSenderType())
                        && "用户超过30分钟未继续咨询，系统已自动结束会话。".equals(message.getContent())
        ));
    }

    @Test
    void doesNotAutoCloseWhenLastUserMessageIsWithinThirtyMinutes() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 1, 17, 0);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("ASSIGNED");
        conversation.setSourceType("HUMAN");
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));
        SupportMessage lastUserMessage = new SupportMessage();
        lastUserMessage.setConversationId(99L);
        lastUserMessage.setSenderType("USER");
        lastUserMessage.setCreateTime(now.minusMinutes(29));
        when(messageMapper.selectOne(any())).thenReturn(lastUserMessage);

        int closedCount = service.closeInactiveAssignedHumanConversations(now);

        assertEquals(0, closedCount);
        assertEquals("ASSIGNED", conversation.getStatus());
        verify(conversationMapper, org.mockito.Mockito.never()).updateById(any());
    }

    @Test
    void doesNotAutoCloseAssignedHumanConversationWithoutUserMessage() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 1, 17, 0);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("ASSIGNED");
        conversation.setSourceType("HUMAN");
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));
        when(messageMapper.selectOne(any())).thenReturn(null);

        int closedCount = service.closeInactiveAssignedHumanConversations(now);

        assertEquals(0, closedCount);
        assertEquals("ASSIGNED", conversation.getStatus());
        verify(conversationMapper, org.mockito.Mockito.never()).updateById(any());
    }

    @Test
    void supportAgentReplyCreatesUserNotification() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);

        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("您好，票夹入口已经为您处理完成。");

        service.sendMessage(30L, 99L, message);

        verify(notificationClient).createMessage(org.mockito.ArgumentMatchers.argThat(request ->
                Long.valueOf(10L).equals(request.getUserId())
                        && request.getOrderId() == null
                        && "SUPPORT_REPLY".equals(request.getType())
                        && request.getContent().contains("客服回复")
                        && "/help".equals(request.getActionHref())
                        && "查看客服会话".equals(request.getActionLabel())
                        && "SUPPORT_REPLY:99".equals(request.getAggregateKey())
        ), eq("internal-token"));
    }

    @Test
    void supportAgentReplySkipsNotificationWhenUserIsViewingHelp() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        service.markHelpPresence(10L, LocalDateTime.now());

        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("您好，客服已回复。");

        service.sendMessage(30L, 99L, message);

        verify(notificationClient, org.mockito.Mockito.never()).createMessage(any(), any());
    }

    @Test
    void supportAgentReplyCreatesNotificationWhenHelpPresenceExpired() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        service.markHelpPresence(10L, LocalDateTime.now().minusMinutes(2));

        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("您好，客服已回复。");

        service.sendMessage(30L, 99L, message);

        verify(notificationClient).createMessage(org.mockito.ArgumentMatchers.argThat(request ->
                Long.valueOf(10L).equals(request.getUserId())
                        && "SUPPORT_REPLY".equals(request.getType())
        ), eq("internal-token"));
    }

    @Test
    void supportAgentReplyCreatesNotificationAfterUserLeavesHelpWindow() {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(userMapper.selectById(10L)).thenReturn(user(10L, "user"));
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        when(conversationMapper.selectById(99L)).thenReturn(conversation);
        service.markHelpPresence(10L, LocalDateTime.now());
        service.clearHelpPresence(10L);

        SupportMessageRequest message = new SupportMessageRequest();
        message.setContent("您好，客服已回复。");

        service.sendMessage(30L, 99L, message);

        verify(notificationClient).createMessage(org.mockito.ArgumentMatchers.argThat(request ->
                Long.valueOf(10L).equals(request.getUserId())
                        && "SUPPORT_REPLY".equals(request.getType())
        ), eq("internal-token"));
    }

    @Test
    void listsWaitingConversationsForSupportAgent() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, "WAITING_AGENT");

        assertEquals(1, response.size());
        assertEquals("WAITING_AGENT", response.get(0).getStatus());
    }

    @Test
    void supportAgentPendingQueueOnlyShowsUnclaimedWaitingConversations() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation publicWaiting = supportConversation(1L, 10L, "WAITING_AGENT", null);
        SupportConversation assignedWaiting = supportConversation(2L, 11L, "WAITING_AGENT", 31L);
        SupportConversation ownAssigned = supportConversation(3L, 12L, "ASSIGNED", 30L);
        when(conversationMapper.selectList(any())).thenReturn(List.of(publicWaiting, assignedWaiting, ownAssigned));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "pending");

        assertEquals(List.of(1L), response.stream().map(SupportConversationResponse::getId).collect(Collectors.toList()));
    }

    @Test
    void supportAgentInProgressQueueOnlyShowsOwnAssignedConversations() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation ownAssigned = supportConversation(1L, 10L, "ASSIGNED", 30L);
        SupportConversation otherAssigned = supportConversation(2L, 11L, "ASSIGNED", 31L);
        SupportConversation publicWaiting = supportConversation(3L, 12L, "WAITING_AGENT", null);
        when(conversationMapper.selectList(any())).thenReturn(List.of(ownAssigned, otherAssigned, publicWaiting));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "in_progress");

        assertEquals(List.of(1L), response.stream().map(SupportConversationResponse::getId).collect(Collectors.toList()));
    }

    @Test
    void responseIncludesSlaWhenHumanConversationWaitsForFirstResponse() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation conversation = supportConversation(1L, 10L, "WAITING_AGENT", null);
        conversation.setFirstResponseDueAt(LocalDateTime.of(2026, 6, 2, 10, 5));
        conversation.setLastUserMessageAt(LocalDateTime.of(2026, 6, 2, 10, 0));
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "pending");

        assertEquals(LocalDateTime.of(2026, 6, 2, 10, 5), response.get(0).getFirstResponseDueAt());
        assertTrue(response.get(0).getUserWaitingSeconds() >= 0);
    }

    @Test
    void supportAgentOverdueQueueShowsOnlyVisibleOverdueConversations() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation overduePublic = supportConversation(1L, 10L, "WAITING_AGENT", null);
        overduePublic.setFirstResponseDueAt(LocalDateTime.now().minusMinutes(1));
        SupportConversation overdueOwn = supportConversation(2L, 11L, "ASSIGNED", 30L);
        overdueOwn.setLastUserMessageAt(LocalDateTime.now().minusMinutes(11));
        SupportConversation overdueOther = supportConversation(3L, 12L, "ASSIGNED", 31L);
        overdueOther.setLastUserMessageAt(LocalDateTime.now().minusMinutes(11));
        SupportConversation normalPublic = supportConversation(4L, 13L, "WAITING_AGENT", null);
        normalPublic.setFirstResponseDueAt(LocalDateTime.now().plusMinutes(4));
        when(conversationMapper.selectList(any())).thenReturn(List.of(overduePublic, overdueOwn, overdueOther, normalPublic));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "overdue");

        assertEquals(List.of(1L, 2L), response.stream().map(SupportConversationResponse::getId).collect(Collectors.toList()));
    }

    @Test
    void supportAgentDefaultQueueExcludesAiOnlyOpenConversations() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
        SupportConversation aiOnly = new SupportConversation();
        aiOnly.setId(98L);
        aiOnly.setUserId(10L);
        aiOnly.setStatus("OPEN");
        SupportConversation waiting = new SupportConversation();
        waiting.setId(99L);
        waiting.setUserId(10L);
        waiting.setStatus("WAITING_AGENT");
        when(conversationMapper.selectList(any())).thenReturn(List.of(aiOnly, waiting));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, null);

        assertEquals(1, response.size());
        assertEquals(99L, response.get(0).getId());
        assertEquals("WAITING_AGENT", response.get(0).getStatus());
    }

    @Test
    void adminConversationListIncludesUserDisplayInfo() {
        when(userMapper.selectById(30L)).thenReturn(user(30L, "admin"));
        User customer = user(10L, "user");
        customer.setNickname("小王");
        customer.setPhone("13812348000");
        when(userMapper.selectById(10L)).thenReturn(customer);
        SupportConversation conversation = new SupportConversation();
        conversation.setId(99L);
        conversation.setUserId(10L);
        conversation.setStatus("WAITING_AGENT");
        when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));

        List<SupportConversationResponse> response = service.listAgentConversations(30L, "WAITING_AGENT");

        assertEquals("小王", response.get(0).getUserNickname());
        assertEquals("138****8000", response.get(0).getUserPhoneMask());
    }

    private User user(Long id, String role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }

    private SupportConversation supportConversation(Long id, Long userId, String status, Long assignedAgentId) {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(id);
        conversation.setUserId(userId);
        conversation.setStatus(status);
        conversation.setSourceType("HUMAN");
        conversation.setAssignedAgentId(assignedAgentId);
        conversation.setCreateTime(LocalDateTime.of(2026, 6, 2, 10, 0));
        conversation.setUpdateTime(LocalDateTime.of(2026, 6, 2, 10, 0));
        return conversation;
    }
}
