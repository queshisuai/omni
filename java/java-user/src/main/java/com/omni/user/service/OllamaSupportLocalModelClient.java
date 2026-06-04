package com.omni.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Stream;

@Service
public class OllamaSupportLocalModelClient implements SupportLocalModelClient {

    private static final Logger log = LoggerFactory.getLogger(OllamaSupportLocalModelClient.class);

    private final boolean enabled;
    private final String endpoint;
    private final String model;
    private final int timeoutMillis;
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public OllamaSupportLocalModelClient(
            @Value("${omni.support.ai.enabled:${omni.support.ai.local.enabled:${OMNI_SUPPORT_AI_ENABLED:${OMNI_SUPPORT_AI_LOCAL_ENABLED:true}}}}") boolean enabled,
            @Value("${omni.support.ai.endpoint:${omni.support.ai.local.endpoint:${OMNI_SUPPORT_AI_ENDPOINT:${OMNI_SUPPORT_AI_LOCAL_ENDPOINT:http://localhost:11434/api/chat}}}}") String endpoint,
            @Value("${omni.support.ai.model:${omni.support.ai.local.model:${OMNI_SUPPORT_AI_MODEL:${OMNI_SUPPORT_AI_LOCAL_MODEL:Qwen2.5:7b}}}}") String model,
            @Value("${omni.support.ai.timeout-ms:${omni.support.ai.local.timeout-ms:${OMNI_SUPPORT_AI_TIMEOUT_MS:${OMNI_SUPPORT_AI_LOCAL_TIMEOUT_MS:30000}}}}") int timeoutMillis,
            @Value("${omni.support.ai.api-key:${OMNI_SUPPORT_AI_API_KEY:}}") String apiKey,
            ObjectMapper objectMapper) {
        this(
                enabled,
                endpoint,
                model,
                timeoutMillis,
                apiKey,
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.max(timeoutMillis, 1000))).build(),
                objectMapper
        );
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
        this.apiKey = apiKey;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<String> answer(String question, String projectKnowledge) {
        if (!enabled || !StringUtils.hasText(question) || !StringUtils.hasText(endpoint) || !StringUtils.hasText(model)) {
            return Optional.empty();
        }

        try {
            HttpRequest request = buildRequest(objectMapper.writeValueAsString(buildPayload(question, projectKnowledge, false)));
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("客服模型网关调用失败: status={}", response.statusCode());
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
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
            HttpRequest request = buildRequest(objectMapper.writeValueAsString(buildPayload(question, projectKnowledge, true)));
            HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.info("客服模型网关流式调用不可用，尝试普通模型回复: status={}", response.statusCode());
                Stream<String> body = response.body();
                if (body != null) {
                    body.close();
                }
                return answerAndEmitBuffered(question, projectKnowledge, onChunk);
            }

            StringBuilder answer = new StringBuilder();
            ThinkTagFilter thinkTagFilter = new ThinkTagFilter();
            try (Stream<String> lines = response.body()) {
                lines.forEach(line -> extractStreamingChunk(line).ifPresent(chunk -> {
                    String visibleChunk = thinkTagFilter.accept(chunk);
                    appendAndEmit(answer, visibleChunk, onChunk);
                }));
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
        return payload;
    }

    private HttpRequest buildRequest(String requestBody) {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofMillis(Math.max(timeoutMillis, 1000)))
                .header("Content-Type", "application/json");
        if (StringUtils.hasText(apiKey)) {
            requestBuilder.header("Authorization", "Bearer " + apiKey.trim());
        }
        return requestBuilder
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
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
