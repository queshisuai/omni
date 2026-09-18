package com.omni.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.client.AiErrorCode;
import com.omni.ai.client.AiModelException;
import com.omni.ai.dto.AiResponse;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.*;
import com.omni.user.entity.SupportAiSuggestion;
import com.omni.user.entity.SupportConversation;
import com.omni.user.mapper.SupportAiSuggestionMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportCopilotServiceTest {
    private final SupportAiSuggestionMapper mapper = mock(SupportAiSuggestionMapper.class);
    private final CsSessionService sessions = mock(CsSessionService.class);
    private final RbacService rbac = mock(RbacService.class);
    private final SupportCopilotContextService contexts = mock(SupportCopilotContextService.class);
    private final AiModelClient ai = mock(AiModelClient.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void generatesReadySuggestionWithoutWritingSupportMessage() {
        SupportConversation conversation = conversation(10L);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation);
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "digest"));
        doAnswer(invocation -> {
            SupportAiSuggestion inserted = invocation.getArgument(0);
            assertEquals("[]", inserted.getMissingInformation());
            assertEquals("[]", inserted.getSourceEvidence());
            inserted.setId(900L);
            return 1;
        }).when(mapper).insertSuggestion(any());
        when(mapper.markReady(anyLong(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        when(ai.generate(any(), any())).thenReturn(new AiResponse("r", "model",
                "{\"suggestionText\":\"请核实订单\",\"sourceEvidence\":[]}",
                "stop", null, 10L));

        CsCopilotSuggestionResponse result = new SupportCopilotService(
                mapper, sessions, rbac, contexts, ai, objectMapper).generate(7L, 10L);

        assertEquals("READY", result.getStatus());
        verify(rbac).requireAnyPermission(7L, "support.ai.use");
        verify(mapper).markReady(eq(900L), eq("请核实订单"), any(), any(), any(), any(), any(),
                eq("model"), any());
        verify(mapper, never()).insert(any());
    }

    @Test
    void reviewActionsRequireReviewPermission() {
        doThrow(new BusinessException(ResultCode.FORBIDDEN, "无权限"))
                .when(rbac).requireAnyPermission(7L, "support.ai.review");

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .accept(7L, 900L));

        assertEquals(ResultCode.FORBIDDEN.getCode(), error.getCode());
        verifyNoInteractions(sessions, mapper, contexts);
    }

    @Test
    void staleAcceptExpiresSuggestionAndReturnsConflictWithoutOldDraft() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "READY", 100L, "old");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 101L, "old"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .accept(7L, 900L));

        assertEquals(ResultCode.CONFLICT.getCode(), error.getCode());
        verify(mapper).expireIfCurrent(eq(900L), eq("READY"), any());
        verify(mapper, never()).transitionToAccepted(anyLong(), anyString(), anyString(),
                anyLong(), anyString(), any());
    }

    @Test
    void editOnlyMovesAcceptedSuggestionAndPreservesSuggestionText() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "ACCEPTED", 100L, "原始建议");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(mapper.transitionToEdited(anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyString(), any())).thenReturn(1);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "old"));

        CsCopilotSuggestionResponse result = new SupportCopilotService(
                mapper, sessions, rbac, contexts, ai, objectMapper).edit(
                7L, 900L, edit("人工修改"));

        assertEquals("ACCEPTED_EDITED", result.getStatus());
        assertEquals("原始建议", result.getSuggestionText());
        assertEquals("人工修改", result.getEditedText());
        verify(mapper).transitionToEdited(eq(900L), eq("ACCEPTED"), eq("ACCEPTED_EDITED"),
                eq("人工修改"), eq(100L), eq("old"), any());
    }

    @Test
    void editBeforeAcceptReturnsConflictWithoutChangingSuggestion() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "READY", 100L, "原始建议");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .edit(7L, 900L, edit("人工修改")));

        assertEquals(ResultCode.CONFLICT.getCode(), error.getCode());
        verify(mapper, never()).transitionToEdited(anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyString(), any());
    }

    @Test
    void changedContextExpiresSuggestionBeforeEdit() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "ACCEPTED", 100L, "原始建议");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "changed"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .edit(7L, 900L, edit("人工修改")));

        assertEquals(ResultCode.CONFLICT.getCode(), error.getCode());
        verify(mapper).expireIfCurrent(eq(900L), eq("ACCEPTED"), any());
        verify(mapper, never()).transitionToEdited(anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyString(), any());
    }

    @Test
    void rejectsReadySuggestionWithoutSendingSupportMessage() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "READY", 100L, "原始建议");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(mapper.transitionToRejected(anyLong(), anyString(), anyString(), any(), any())).thenReturn(1);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));

        CsCopilotRejectRequest request = new CsCopilotRejectRequest();
        request.setReason("不适用");
        CsCopilotSuggestionResponse result = new SupportCopilotService(
                mapper, sessions, rbac, contexts, ai, objectMapper).reject(7L, 900L, request);

        assertEquals("REJECTED", result.getStatus());
        verify(mapper).transitionToRejected(eq(900L), eq("READY"), eq("REJECTED"), eq("不适用"), any());
        verify(mapper, never()).insert(any());
    }

    @Test
    void concurrentAcceptReturnsConflictAfterAtomicTransitionMiss() {
        SupportAiSuggestion suggestion = suggestion(900L, 10L, "READY", 100L, "原始建议");
        when(mapper.selectSuggestionById(900L)).thenReturn(suggestion);
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "old"));
        when(mapper.transitionToAccepted(anyLong(), anyString(), anyString(), anyLong(), anyString(), any()))
                .thenReturn(0);

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .accept(7L, 900L));

        assertEquals(ResultCode.CONFLICT.getCode(), error.getCode());
        verify(mapper).transitionToAccepted(eq(900L), eq("READY"), eq("ACCEPTED"),
                eq(100L), eq("old"), any());
        verify(mapper).expireIfCurrent(eq(900L), eq("READY"), any());
    }

    @Test
    void hallucinatedFactKeyMarksSuggestionFailed() {
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "digest"));
        doAnswer(invocation -> {
            invocation.<SupportAiSuggestion>getArgument(0).setId(902L);
            return 1;
        }).when(mapper).insertSuggestion(any());
        when(ai.generate(any(), any())).thenReturn(new AiResponse("r", "model",
                "{\"suggestionText\":\"请核实\",\"sourceEvidence\":[{\"factKey\":\"refund.status\"}]}",
                "stop", null, 10L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .generate(7L, 10L));

        assertEquals(502, error.getCode());
        verify(mapper).markFailed(eq(902L), eq("INVALID_OUTPUT"), eq("模型输出无法通过校验"), any());
    }

    @Test
    void timeoutMarksGeneratingSuggestionFailedAndHidesProviderDetails() {
        when(sessions.requireVisibleConversation(7L, 10L)).thenReturn(conversation(10L));
        when(contexts.build(7L, 10L)).thenReturn(context(10L, 100L, "digest"));
        doAnswer(invocation -> {
            invocation.<SupportAiSuggestion>getArgument(0).setId(901L);
            return 1;
        }).when(mapper).insertSuggestion(any());
        when(ai.generate(any(), any())).thenThrow(new AiModelException(AiErrorCode.TIMEOUT, "secret-request-id"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new SupportCopilotService(mapper, sessions, rbac, contexts, ai, objectMapper)
                        .generate(7L, 10L));

        assertEquals(503, error.getCode());
        assertEquals("AI 建议暂时不可用", error.getMessage());
        verify(mapper).markFailed(eq(901L), eq("TIMEOUT"), eq("AI 建议暂时不可用"), any());
    }

    private static SupportCopilotContext context(Long id, Long cutoff, String digest) {
        SupportCopilotContext context = new SupportCopilotContext();
        context.setConversationId(id);
        context.setMessageCutoff(cutoff);
        context.setContextDigest(digest);
        context.setBusinessContext(SupportContextResponse.empty(id, 20L, "用户", null));
        return context;
    }

    private static SupportAiSuggestion suggestion(Long id, Long conversationId, String status, Long cutoff, String text) {
        SupportAiSuggestion suggestion = new SupportAiSuggestion();
        suggestion.setId(id);
        suggestion.setConversationId(conversationId);
        suggestion.setAgentId(7L);
        suggestion.setStatus(status);
        suggestion.setMessageCutoff(cutoff);
        suggestion.setContextDigest("old");
        suggestion.setSuggestionText(text);
        suggestion.setCreateTime(LocalDateTime.now());
        return suggestion;
    }

    private static SupportConversation conversation(Long id) {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(id);
        conversation.setStatus("ASSIGNED");
        return conversation;
    }

    private static CsCopilotEditRequest edit(String text) {
        CsCopilotEditRequest request = new CsCopilotEditRequest();
        request.setEditedText(text);
        return request;
    }
}
