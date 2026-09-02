package com.omni.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.net.HttpURLConnection;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

@Service
public class OllamaSupportLocalModelClient implements SupportLocalModelClient {

    private static final Logger log = LoggerFactory.getLogger(OllamaSupportLocalModelClient.class);
    private static final int DEFAULT_CONTEXT_WINDOW = 2048;

    private final boolean enabled;
    private final String endpoint;
    private final String model;
    private final int timeoutMillis;
    private final int contextWindow;
    private final String apiKey;
    private final ObjectMapper objectMapper;

    @Autowired
    public OllamaSupportLocalModelClient(
            @Value("${omni.support.ai.enabled:${omni.support.ai.local.enabled:${OMNI_SUPPORT_AI_ENABLED:${OMNI_SUPPORT_AI_LOCAL_ENABLED:true}}}}") boolean enabled,
            @Value("${omni.support.ai.endpoint:${omni.support.ai.local.endpoint:${OMNI_SUPPORT_AI_ENDPOINT:${OMNI_SUPPORT_AI_LOCAL_ENDPOINT:http://localhost:11434/api/chat}}}}") String endpoint,
            @Value("${omni.support.ai.model:${omni.support.ai.local.model:${OMNI_SUPPORT_AI_MODEL:${OMNI_SUPPORT_AI_LOCAL_MODEL:Qwen2.5:7b}}}}") String model,
            @Value("${omni.support.ai.timeout-ms:${omni.support.ai.local.timeout-ms:${OMNI_SUPPORT_AI_TIMEOUT_MS:${OMNI_SUPPORT_AI_LOCAL_TIMEOUT_MS:30000}}}}") int timeoutMillis,
            @Value("${omni.support.ai.context-window:${omni.support.ai.local.context-window:${OMNI_SUPPORT_AI_CONTEXT_WINDOW:${OMNI_SUPPORT_AI_LOCAL_CONTEXT_WINDOW:2048}}}}") int contextWindow,
            @Value("${omni.support.ai.api-key:${OMNI_SUPPORT_AI_API_KEY:}}") String apiKey,
            ObjectMapper objectMapper) {
        this.enabled = enabled;
        this.endpoint = endpoint;
        this.model = model;
        this.timeoutMillis = timeoutMillis;
        this.contextWindow = contextWindow;
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
    }

    OllamaSupportLocalModelClient(
            boolean enabled,
            String endpoint,
            String model,
            int timeoutMillis,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this(enabled, endpoint, model, timeoutMillis, null, httpClient, objectMapper);
    }

    OllamaSupportLocalModelClient(
            boolean enabled,
            String endpoint,
            String model,
            int timeoutMillis,
            String apiKey,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this.enabled = enabled;
        this.endpoint = endpoint;
        this.model = model;
        this.timeoutMillis = timeoutMillis;
        this.contextWindow = DEFAULT_CONTEXT_WINDOW;
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<String> answer(String question, String projectKnowledge) {
        if (!enabled || !StringUtils.hasText(question) || !StringUtils.hasText(endpoint) || !StringUtils.hasText(model)) {
            return Optional.empty();
        }

        try {
            String requestBody = objectMapper.writeValueAsString(buildPayload(question, projectKnowledge, false));
            HttpURLConnection connection = openConnection(requestBody);
            int statusCode = connection.getResponseCode();
            String responseBody = readConnectionBody(connection, statusCode);
            if (statusCode < 200 || statusCode >= 300) {
                log.warn("客服模型网关调用失败: status={}", statusCode);
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(responseBody);
            Optional<String> answer = extractAnswer(root);
            if (answer.isPresent()) {
                return answer;
            }
        } catch (Exception e) {
            log.warn("客服模型网关不可用，已切换项目规则回复");
        }
        return Optional.empty();
    }

    @Override
    public Optional<String> streamAnswer(String question, String projectKnowledge, Consumer<String> onChunk) {
        if (!enabled || !StringUtils.hasText(question) || !StringUtils.hasText(endpoint) || !StringUtils.hasText(model)) {
            return Optional.empty();
        }

        try {
            String requestBody = objectMapper.writeValueAsString(buildPayload(question, projectKnowledge, true));
            HttpURLConnection connection = openConnection(requestBody);
            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                readConnectionBody(connection, statusCode);
                log.info("客服模型网关流式调用不可用，尝试普通模型回复: status={}", statusCode);
                return answerAndEmitBuffered(question, projectKnowledge, onChunk);
            }

            StringBuilder answer = new StringBuilder();
            ThinkTagFilter thinkTagFilter = new ThinkTagFilter();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    extractStreamingChunk(line).ifPresent(chunk -> {
                    String visibleChunk = thinkTagFilter.accept(chunk);
                    appendAndEmit(answer, visibleChunk, onChunk);
                    });
                }
            } finally {
                connection.disconnect();
            }
            appendAndEmit(answer, thinkTagFilter.flush(), onChunk);

            String fullAnswer = answer.toString().trim();
            return StringUtils.hasText(fullAnswer) ? Optional.of(fullAnswer) : Optional.empty();
        } catch (Exception e) {
            log.warn("客服模型网关流式调用不可用，已切换项目规则回复");
            return Optional.empty();
        }
    }

    private Optional<String> answerAndEmitBuffered(String question, String projectKnowledge, Consumer<String> onChunk) {
        Optional<String> answer = answer(question, projectKnowledge);
        answer.ifPresent(value -> emitInChunks(value, onChunk));
        return answer;
    }

    private Map<String, Object> buildPayload(String question, String projectKnowledge, boolean stream) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("stream", stream);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", projectKnowledge),
                Map.of("role", "user", "content", question)
        ));
        if (contextWindow > 0) {
            payload.put("options", Map.of("num_ctx", contextWindow));
        }
        return payload;
    }

    private HttpURLConnection openConnection(String requestBody) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(endpoint).toURL().openConnection();
        int effectiveTimeoutMillis = Math.max(timeoutMillis, 1000);
        connection.setConnectTimeout(effectiveTimeoutMillis);
        connection.setReadTimeout(effectiveTimeoutMillis);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        if (StringUtils.hasText(apiKey)) {
            connection.setRequestProperty("Authorization", "Bearer " + apiKey.trim());
        }
        byte[] bytes = requestBody.getBytes(StandardCharsets.UTF_8);
        connection.setRequestProperty("Content-Length", String.valueOf(bytes.length));
        try (OutputStream outputStream = connection.getOutputStream()) {
            outputStream.write(bytes);
        }
        return connection;
    }

    private String readConnectionBody(HttpURLConnection connection, int statusCode) throws Exception {
        try {
            InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) {
                return "";
            }
            try (InputStream body = stream) {
                return new String(body.readAllBytes(), StandardCharsets.UTF_8);
            }
        } finally {
            connection.disconnect();
        }
    }

    private Optional<String> extractStreamingChunk(String line) {
        if (line == null || line.isBlank()) {
            return Optional.empty();
        }
        String payload = line.trim();
        if (payload.startsWith("data:")) {
            payload = payload.substring("data:".length()).trim();
        }
        if (payload.isEmpty() || "[DONE]".equals(payload)) {
            return Optional.empty();
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            String openAiChunk = root.path("choices").path(0).path("delta").path("content").asText("");
            if (!openAiChunk.isEmpty()) {
                return Optional.of(openAiChunk);
            }
            String openAiMessage = root.path("choices").path(0).path("message").path("content").asText("");
            if (!openAiMessage.isEmpty()) {
                return Optional.of(openAiMessage);
            }
            String ollamaChatChunk = root.path("message").path("content").asText("");
            if (!ollamaChatChunk.isEmpty()) {
                return Optional.of(ollamaChatChunk);
            }
            String ollamaGenerateChunk = root.path("response").asText("");
            return ollamaGenerateChunk.isEmpty() ? Optional.empty() : Optional.of(ollamaGenerateChunk);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private void appendAndEmit(StringBuilder answer, String chunk, Consumer<String> onChunk) {
        if (chunk == null || chunk.isEmpty()) {
            return;
        }
        answer.append(chunk);
        if (onChunk != null) {
            onChunk.accept(chunk);
        }
    }

    private void emitInChunks(String answer, Consumer<String> onChunk) {
        if (!StringUtils.hasText(answer) || onChunk == null) {
            return;
        }
        int chunkSize = 8;
        for (int start = 0; start < answer.length(); start += chunkSize) {
            int end = Math.min(answer.length(), start + chunkSize);
            onChunk.accept(answer.substring(start, end));
        }
    }

    private Optional<String> extractAnswer(JsonNode root) {
        if (root == null || root.isMissingNode() || root.isNull()) {
            return Optional.empty();
        }
        Optional<String> openAiContent = cleanAnswer(root.path("choices").path(0).path("message").path("content").asText(""));
        if (openAiContent.isPresent()) {
            return openAiContent;
        }

        Optional<String> ollamaChatContent = cleanAnswer(root.path("message").path("content").asText(""));
        if (ollamaChatContent.isPresent()) {
            return ollamaChatContent;
        }

        return cleanAnswer(root.path("response").asText(""));
    }

    private Optional<String> cleanAnswer(String content) {
        if (!StringUtils.hasText(content)) {
            return Optional.empty();
        }
        String cleaned = content.replaceAll("(?is)<think>.*?</think>", "").trim();
        return StringUtils.hasText(cleaned) ? Optional.of(cleaned) : Optional.empty();
    }

    private static class ThinkTagFilter {
        private static final String START_TAG = "<think>";
        private static final String END_TAG = "</think>";
        private static final int MAX_TAG_LENGTH = END_TAG.length();

        private boolean inThink;
        private String carry = "";

        String accept(String chunk) {
            if (chunk == null || chunk.isEmpty()) {
                return "";
            }
            String input = carry + chunk;
            carry = "";
            StringBuilder output = new StringBuilder();
            int index = 0;
            while (index < input.length()) {
                String remainingLower = input.substring(index).toLowerCase(Locale.ROOT);
                if (inThink) {
                    int end = remainingLower.indexOf(END_TAG);
                    if (end < 0) {
                        carry = input.substring(Math.max(index, input.length() - MAX_TAG_LENGTH));
                        return output.toString();
                    }
                    index += end + END_TAG.length();
                    inThink = false;
                    continue;
                }

                int start = remainingLower.indexOf(START_TAG);
                if (start < 0) {
                    int safeEnd = Math.max(index, input.length() - START_TAG.length());
                    output.append(input, index, safeEnd);
                    carry = input.substring(safeEnd);
                    return output.toString();
                }
                output.append(input, index, index + start);
                index += start + START_TAG.length();
                inThink = true;
            }
            return output.toString();
        }

        String flush() {
            if (inThink) {
                carry = "";
                return "";
            }
            String tail = carry;
            carry = "";
            return tail;
        }
    }
}
