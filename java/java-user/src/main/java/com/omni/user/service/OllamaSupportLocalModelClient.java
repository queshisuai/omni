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
import java.util.Map;
import java.util.Optional;

@Service
public class OllamaSupportLocalModelClient implements SupportLocalModelClient {

    private static final Logger log = LoggerFactory.getLogger(OllamaSupportLocalModelClient.class);

    private final boolean enabled;
    private final String endpoint;
    private final String model;
    private final int timeoutMillis;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public OllamaSupportLocalModelClient(
            @Value("${omni.support.ai.local.enabled:${OMNI_SUPPORT_AI_LOCAL_ENABLED:false}}") boolean enabled,
            @Value("${omni.support.ai.local.endpoint:${OMNI_SUPPORT_AI_LOCAL_ENDPOINT:http://localhost:11434/api/chat}}") String endpoint,
            @Value("${omni.support.ai.local.model:${OMNI_SUPPORT_AI_LOCAL_MODEL:qwen2.5:7b}}") String model,
            @Value("${omni.support.ai.local.timeout-ms:${OMNI_SUPPORT_AI_LOCAL_TIMEOUT_MS:8000}}") int timeoutMillis,
            ObjectMapper objectMapper) {
        this(
                enabled,
                endpoint,
                model,
                timeoutMillis,
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
        this.enabled = enabled;
        this.endpoint = endpoint;
        this.model = model;
        this.timeoutMillis = timeoutMillis;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<String> answer(String question, String projectKnowledge) {
        if (!enabled || !StringUtils.hasText(question) || !StringUtils.hasText(endpoint) || !StringUtils.hasText(model)) {
            return Optional.empty();
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("stream", false);
            payload.put("messages", List.of(
                    Map.of("role", "system", "content", projectKnowledge),
                    Map.of("role", "user", "content", question)
            ));

            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofMillis(Math.max(timeoutMillis, 1000)))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("本地客服模型调用失败: status={}", response.statusCode());
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
            String chatContent = root.path("message").path("content").asText("");
            if (StringUtils.hasText(chatContent)) {
                return Optional.of(chatContent.trim());
            }

            String generateContent = root.path("response").asText("");
            if (StringUtils.hasText(generateContent)) {
                return Optional.of(generateContent.trim());
            }
        } catch (Exception e) {
            log.warn("本地客服模型不可用，已切换项目规则回复");
        }
        return Optional.empty();
    }
}
