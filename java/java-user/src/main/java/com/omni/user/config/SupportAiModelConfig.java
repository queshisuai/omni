package com.omni.user.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.client.OllamaAiModelClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 沿用客服现有的唯一模型配置及其历史别名。 */
@Configuration
public class SupportAiModelConfig {
    @Bean
    public AiModelClient aiModelClient(
            @Value("${omni.support.ai.enabled:${omni.support.ai.local.enabled:${OMNI_SUPPORT_AI_ENABLED:${OMNI_SUPPORT_AI_LOCAL_ENABLED:true}}}}") boolean enabled,
            @Value("${omni.support.ai.endpoint:${omni.support.ai.local.endpoint:${OMNI_SUPPORT_AI_ENDPOINT:${OMNI_SUPPORT_AI_LOCAL_ENDPOINT:http://localhost:11434/api/chat}}}}") String endpoint,
            @Value("${omni.support.ai.model:${omni.support.ai.local.model:${OMNI_SUPPORT_AI_MODEL:${OMNI_SUPPORT_AI_LOCAL_MODEL:Qwen2.5:7b}}}}") String model,
            @Value("${omni.support.ai.timeout-ms:${omni.support.ai.local.timeout-ms:${OMNI_SUPPORT_AI_TIMEOUT_MS:${OMNI_SUPPORT_AI_LOCAL_TIMEOUT_MS:30000}}}}") int timeoutMillis,
            @Value("${omni.support.ai.context-window:${omni.support.ai.local.context-window:${OMNI_SUPPORT_AI_CONTEXT_WINDOW:${OMNI_SUPPORT_AI_LOCAL_CONTEXT_WINDOW:2048}}}}") int contextWindow,
            @Value("${omni.support.ai.api-key:${OMNI_SUPPORT_AI_API_KEY:}}") String apiKey,
            ObjectMapper objectMapper) {
        return new OllamaAiModelClient(enabled, endpoint, model, timeoutMillis, contextWindow, apiKey, objectMapper);
    }
}
