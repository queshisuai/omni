package com.omni.ai.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class AiDtoTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void requestPreservesOptionsAndDefensivelyCopiesMessages() throws Exception {
        List<AiMessage> messages = new ArrayList<>();
        messages.add(new AiMessage("user", "请说明规则"));
        AiRequest request = new AiRequest("request-1", "qwen", "平台规则", messages, 0.2, 128, 2048);
        messages.clear();
        AiRequest decoded = mapper.readValue(mapper.writeValueAsString(request), AiRequest.class);
        assertEquals(1, decoded.getMessages().size());
        assertEquals("请说明规则", decoded.getMessages().get(0).getContent());
        assertEquals(0.2, decoded.getTemperature());
        assertEquals(128, decoded.getMaxTokens());
        assertEquals(2048, decoded.getContextWindow());
        assertEquals("平台规则", decoded.getSystemPrompt());
        assertThrows(UnsupportedOperationException.class, () -> request.getMessages().clear());
    }

    @Test
    void requestRoundTripPreservesOptionalResponseFormat() throws Exception {
        ObjectNode format = mapper.createObjectNode()
                .put("type", "object")
                .put("additionalProperties", false);
        AiRequest request = new AiRequest("request-2", "qwen", "平台规则",
                List.of(new AiMessage("user", "请输出 JSON")), null, null, null, format);

        AiRequest decoded = mapper.readValue(mapper.writeValueAsString(request), AiRequest.class);

        assertEquals("object", decoded.getResponseFormat().path("type").asText());
        assertFalse(decoded.getResponseFormat().path("additionalProperties").asBoolean());
    }

    @Test
    void responseAndChunkRoundTripWithUnknownUsage() throws Exception {
        AiResponse response = new AiResponse("r", "qwen", "回答", "stop", new AiUsage(null, null, null), 15);
        AiResponse decoded = mapper.readValue(mapper.writeValueAsString(response), AiResponse.class);
        assertNull(decoded.getUsage().getTotalTokens());
        assertEquals(15, decoded.getLatencyMillis());
        AiStreamChunk chunk = new AiStreamChunk("r", "qwen", 2, "", "stop", new AiUsage(2L, 3L, 5L), 16);
        AiStreamChunk copy = mapper.readValue(mapper.writeValueAsString(chunk), AiStreamChunk.class);
        assertEquals("stop", copy.getFinishReason());
        assertEquals(5L, copy.getUsage().getTotalTokens());
        assertEquals(2, copy.getSequence());
    }
}
