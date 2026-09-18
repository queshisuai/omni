package com.omni.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.user.dto.SupportContextResponse;
import com.omni.user.dto.SupportCopilotContext;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.SupportMessage;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportMessageMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SupportCopilotContextServiceTest {

    @Test
    void usesStableLatestMessageIdLimitsPublicHistoryAndRedactsSensitiveContent() {
        SupportConversationMapper conversations = mock(SupportConversationMapper.class);
        SupportMessageMapper messages = mock(SupportMessageMapper.class);
        SupportContextService supportContext = mock(SupportContextService.class);
        when(conversations.selectById(10L)).thenReturn(conversation(10L));
        when(messages.selectList(any())).thenReturn(
                List.of(message(100L, "AGENT", "最后消息")),
                publicMessages(60));
        when(supportContext.getContext(7L, 10L)).thenReturn(SupportContextResponse.empty(10L, 20L, "用户", "139****0001"));

        SupportCopilotContext result = new SupportCopilotContextService(
                conversations, messages, supportContext, new ObjectMapper()).build(7L, 10L);

        assertEquals(100L, result.getMessageCutoff());
        assertEquals(50, result.getMessages().size());
        assertEquals("[手机号已脱敏]", result.getMessages().get(0).getContent());
        assertTrue(result.getContextDigest().matches("[0-9a-f]{64}"));
    }

    @Test
    void contextDigestChangesWhenBusinessFactChanges() {
        SupportConversationMapper conversations = mock(SupportConversationMapper.class);
        SupportMessageMapper messages = mock(SupportMessageMapper.class);
        SupportContextService supportContext = mock(SupportContextService.class);
        when(conversations.selectById(10L)).thenReturn(conversation(10L));
        when(messages.selectList(any())).thenReturn(
                List.of(message(100L, "AGENT", "最后消息")),
                List.of(message(100L, "AGENT", "最后消息")));
        SupportContextResponse first = SupportContextResponse.empty(10L, 20L, "用户", "139****0001");
        SupportContextResponse second = SupportContextResponse.empty(10L, 20L, "用户", "139****0001");
        first.setOrders(List.of(order("DM-1")));
        second.setOrders(List.of(order("DM-2")));
        when(supportContext.getContext(7L, 10L)).thenReturn(first).thenReturn(second);
        SupportCopilotContextService service = new SupportCopilotContextService(
                conversations, messages, supportContext, new ObjectMapper());

        String firstDigest = service.build(7L, 10L).getContextDigest();
        String secondDigest = service.build(7L, 10L).getContextDigest();

        assertNotEquals(firstDigest, secondDigest);
    }

    @Test
    void treatsNullMapperListsAsEmptyAndReportsMissingMessages() {
        SupportConversationMapper conversations = mock(SupportConversationMapper.class);
        SupportMessageMapper messages = mock(SupportMessageMapper.class);
        SupportContextService supportContext = mock(SupportContextService.class);
        when(conversations.selectById(10L)).thenReturn(conversation(10L));
        when(messages.selectList(any())).thenReturn(null);

        SupportCopilotContextService service = new SupportCopilotContextService(
                conversations, messages, supportContext, new ObjectMapper());

        assertThrows(com.omni.exception.BusinessException.class,
                () -> service.build(7L, 10L));
    }

    private static List<SupportMessage> publicMessages(int count) {
        List<SupportMessage> result = new ArrayList<>();
        for (int i = 1; i <= count; i++) result.add(message((long) i, "USER", "13900000001"));
        return result;
    }

    private static SupportMessage message(Long id, String senderType, String content) {
        SupportMessage message = new SupportMessage();
        message.setId(id);
        message.setSenderType(senderType);
        message.setContent(content);
        return message;
    }

    private static SupportConversation conversation(Long id) {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(id);
        conversation.setStatus("ASSIGNED");
        conversation.setSubject("订单咨询");
        conversation.setSourceType("HUMAN");
        return conversation;
    }

    private static SupportContextResponse.SupportContextOrder order(String orderNo) {
        SupportContextResponse.SupportContextOrder order = new SupportContextResponse.SupportContextOrder();
        order.setOrderNo(orderNo);
        return order;
    }
}
