package com.omni.user.service;

import com.omni.ai.client.*;
import com.omni.ai.dto.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.Optional;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportModelAdapterTest {
    @Test
    void passesOnlyExistingQuestionAndKnowledgeToSharedClient() {
        AiModelClient core = mock(AiModelClient.class);
        when(core.generate(any())).thenReturn(new AiResponse("r", "qwen", "回答", null, null, 1));
        OllamaSupportLocalModelClient adapter = new OllamaSupportLocalModelClient(core);
        assertEquals(Optional.of("回答"), adapter.answer("问题", "规则"));
        ArgumentCaptor<AiRequest> request = ArgumentCaptor.forClass(AiRequest.class);
        verify(core).generate(request.capture());
        assertEquals("规则", request.getValue().getSystemPrompt());
        assertEquals("问题", request.getValue().getMessages().get(0).getContent());
        assertNull(request.getValue().getTemperature());
        assertNull(request.getValue().getModel());
        assertNull(request.getValue().getMaxTokens());
        assertNull(request.getValue().getContextWindow());
    }

    @Test
    void keepsHttpOnlyBufferedFallbackAndEightCharacterChunks() {
        AiModelClient core = mock(AiModelClient.class);
        when(core.stream(any(), any())).thenThrow(new AiModelException(AiErrorCode.HTTP_ERROR, "r", 400));
        when(core.generate(any())).thenReturn(new AiResponse("r", "qwen", "一二三四五六七八九十", null, null, 1));
        StringBuilder text = new StringBuilder();
        OllamaSupportLocalModelClient adapter = new OllamaSupportLocalModelClient(core);
        assertEquals(Optional.of("一二三四五六七八九十"), adapter.streamAnswer("问题", "规则", chunk -> {
            assertTrue(chunk.length() <= 8);
            text.append(chunk);
        }));
        assertEquals("一二三四五六七八九十", text.toString());
        verify(core).generate(any());
    }

    @Test
    void modelFailureReturnsEmptyForExistingRulesAndNeverRetriesPartialStream() {
        AiModelClient core = mock(AiModelClient.class);
        when(core.generate(any())).thenThrow(new AiModelException(AiErrorCode.TIMEOUT, "r"));
        when(core.stream(any(), any())).thenAnswer(invocation -> {
            Consumer<AiStreamChunk> callback = invocation.getArgument(1);
            callback.accept(new AiStreamChunk("r", "qwen", 0, "已输出", null, null, 1));
            throw new AiModelException(AiErrorCode.SSE_ERROR, "r");
        });
        OllamaSupportLocalModelClient adapter = new OllamaSupportLocalModelClient(core);
        assertTrue(adapter.answer("问题", "规则").isEmpty());
        clearInvocations(core);
        StringBuilder text = new StringBuilder();
        assertTrue(adapter.streamAnswer("问题", "规则", text::append).isEmpty());
        assertEquals("已输出", text.toString());
        verify(core, never()).generate(any());
    }

    @Test
    void blankQuestionDoesNotInvokeCoreAndNullConsumerIsAllowed() {
        AiModelClient core = mock(AiModelClient.class);
        OllamaSupportLocalModelClient adapter = new OllamaSupportLocalModelClient(core);
        assertTrue(adapter.answer(" ", "规则").isEmpty());
        assertTrue(adapter.streamAnswer(null, "规则", null).isEmpty());
        verifyNoInteractions(core);
    }
}
