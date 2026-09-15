package com.omni.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiErrorCode;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.client.AiModelException;
import com.omni.ai.client.OllamaAiModelClient;
import com.omni.ai.dto.AiMessage;
import com.omni.ai.dto.AiRequest;
import com.omni.user.config.SupportAiModelConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

/** 旧客服兼容入口；HTTP、协议解析及过滤均由共享核心处理。 */
@Service
@Import(SupportAiModelConfig.class)
public class OllamaSupportLocalModelClient implements SupportLocalModelClient {
    private static final Logger log = LoggerFactory.getLogger(OllamaSupportLocalModelClient.class);
    private final AiModelClient modelClient;

    @Autowired
    public OllamaSupportLocalModelClient(AiModelClient modelClient) {
        this.modelClient = modelClient;
    }

    public OllamaSupportLocalModelClient(boolean enabled, String endpoint, String model, int timeoutMillis,
                                         int contextWindow, String apiKey, ObjectMapper objectMapper) {
        this(new OllamaAiModelClient(enabled, endpoint, model, timeoutMillis, contextWindow, apiKey, objectMapper));
    }

    OllamaSupportLocalModelClient(boolean enabled, String endpoint, String model, int timeoutMillis,
                                  HttpClient httpClient, ObjectMapper objectMapper) {
        this(enabled, endpoint, model, timeoutMillis, 2048, null, objectMapper);
    }

    OllamaSupportLocalModelClient(boolean enabled, String endpoint, String model, int timeoutMillis,
                                  String apiKey, HttpClient httpClient, ObjectMapper objectMapper) {
        this(enabled, endpoint, model, timeoutMillis, 2048, apiKey, objectMapper);
    }

    @Override
    public Optional<String> answer(String question, String projectKnowledge) {
        if (!StringUtils.hasText(question)) return Optional.empty();
        try {
            return Optional.of(modelClient.generate(request(question, projectKnowledge)).getText());
        } catch (Exception e) {
            log.warn("客服模型网关不可用，已切换项目规则回复");
            return Optional.empty();
        }
    }

    @Override
    public Optional<String> streamAnswer(String question, String projectKnowledge, Consumer<String> onChunk) {
        if (!StringUtils.hasText(question)) return Optional.empty();
        try {
            return Optional.of(modelClient.stream(request(question, projectKnowledge), chunk -> {
                if (onChunk != null && !chunk.getText().isEmpty()) onChunk.accept(chunk.getText());
            }).getText());
        } catch (AiModelException e) {
            if (e.getCode() == AiErrorCode.HTTP_ERROR) {
                log.info("客服模型网关流式调用不可用，尝试普通模型回复: status={}", e.getHttpStatus());
                return answerAndEmitBuffered(question, projectKnowledge, onChunk);
            }
            log.warn("客服模型网关流式调用不可用，已切换项目规则回复");
            return Optional.empty();
        } catch (Exception e) {
            log.warn("客服模型网关流式调用不可用，已切换项目规则回复");
            return Optional.empty();
        }
    }

    private AiRequest request(String question, String projectKnowledge) {
        return new AiRequest(null, null, projectKnowledge, List.of(new AiMessage("user", question)), null, null, null);
    }

    private Optional<String> answerAndEmitBuffered(String question, String projectKnowledge, Consumer<String> onChunk) {
        Optional<String> answer = answer(question, projectKnowledge);
        try {
            if (answer.isPresent() && onChunk != null) {
                String text = answer.get();
                for (int start = 0; start < text.length(); start += 8) {
                    onChunk.accept(text.substring(start, Math.min(text.length(), start + 8)));
                }
            }
            return answer;
        } catch (Exception e) {
            log.warn("客服模型回复推送失败");
            return Optional.empty();
        }
    }
}
