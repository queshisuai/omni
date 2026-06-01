package com.omni.user.service;

import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportConversationRequest;
import com.omni.user.dto.SupportConversationResponse;
import com.omni.user.dto.SupportMessageRequest;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
    private final CustomerSupportService service = new CustomerSupportService(
            conversationMapper,
            messageMapper,
            userMapper,
            new SupportAiService((question, projectKnowledge) -> java.util.Optional.empty())
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
        verify(conversationMapper, atLeastOnce()).updateById(conversation);
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

    private User user(Long id, String role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }
}
