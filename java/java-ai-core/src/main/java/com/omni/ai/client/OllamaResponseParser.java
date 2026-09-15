package com.omni.ai.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.omni.ai.dto.AiUsage;

/** 从原客服客户端迁出的 Ollama / OpenAI 响应字段解析。 */
final class OllamaResponseParser {
    private final ObjectMapper mapper;

    OllamaResponseParser(ObjectMapper mapper) { this.mapper = mapper; }

    JsonNode parse(String json, String requestId, boolean stream) {
        try {
            JsonNode root = mapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(json);
            if (root == null || root.isNull()) {
                throw new AiModelException(AiErrorCode.EMPTY_RESULT, requestId);
            }
            if (!root.isObject()) throw new JsonProcessingException("模型响应必须为对象") {};
            if (root.hasNonNull("error")) throw new AiModelException(AiErrorCode.UNAVAILABLE, requestId);
            return root;
        } catch (JsonProcessingException e) {
            throw new AiModelException(stream ? AiErrorCode.SSE_ERROR : AiErrorCode.JSON_ERROR, requestId);
        }
    }

    String text(JsonNode root) {
        String text = root.path("choices").path(0).path("delta").path("content").asText("");
        if (text.isEmpty()) text = root.path("choices").path(0).path("message").path("content").asText("");
        if (text.isEmpty()) text = root.path("message").path("content").asText("");
        if (text.isEmpty()) text = root.path("response").asText("");
        return text;
    }

    String finishReason(JsonNode root) {
        String reason = root.path("choices").path(0).path("finish_reason").asText(null);
        if (reason == null) reason = root.path("done_reason").asText(null);
        if (reason == null && root.path("done").asBoolean()) reason = "stop";
        return reason;
    }

    AiUsage usage(JsonNode root, AiUsage previous) {
        JsonNode usage = root.path("usage");
        Long input = count(usage.get("prompt_tokens"));
        Long output = count(usage.get("completion_tokens"));
        Long total = count(usage.get("total_tokens"));
        if (input == null) input = count(root.get("prompt_eval_count"));
        if (output == null) output = count(root.get("eval_count"));
        if (input == null) input = previous.getInputTokens();
        if (output == null) output = previous.getOutputTokens();
        if (total == null && input != null && output != null && Long.MAX_VALUE - input >= output) total = input + output;
        if (total == null) total = previous.getTotalTokens();
        return new AiUsage(input, output, total);
    }

    private Long count(JsonNode value) {
        return value != null && value.isIntegralNumber() && value.canConvertToLong() && value.asLong() >= 0
                ? value.asLong() : null;
    }
}
