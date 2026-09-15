package com.omni.user.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiModelClient;
import com.omni.user.service.OllamaSupportLocalModelClient;
import com.omni.user.service.SupportLocalModelClient;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import java.lang.reflect.Field;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class SupportAiModelConfigTest {
    @Test
    void legacyPropertiesStillConfigureTheSingleSharedBean() throws Exception {
        try (AnnotationConfigApplicationContext context = context(Map.of(
                "omni.support.ai.local.enabled", "false", "omni.support.ai.local.endpoint", "http://localhost:9/api/chat",
                "omni.support.ai.local.model", "legacy", "omni.support.ai.local.timeout-ms", "1234",
                "omni.support.ai.local.context-window", "4096"))) {
            AiModelClient client = context.getBean(AiModelClient.class);
            assertEquals(1, context.getBeansOfType(AiModelClient.class).size());
            assertEquals(false, field(client, "enabled"));
            assertEquals("legacy", field(client, "model"));
            assertEquals(1234, field(client, "timeoutMillis"));
            assertEquals(4096, field(client, "contextWindow"));
            assertSame(client, field(context.getBean(SupportLocalModelClient.class), "modelClient"));
        }
    }

    @Test
    void currentPropertiesTakePrecedenceOverLegacyAliases() throws Exception {
        try (AnnotationConfigApplicationContext context = context(Map.of(
                "omni.support.ai.model", "current", "omni.support.ai.local.model", "legacy",
                "omni.support.ai.enabled", "false"))) {
            assertEquals("current", field(context.getBean(AiModelClient.class), "model"));
        }
    }

    private AnnotationConfigApplicationContext context(Map<String, Object> properties) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", properties));
        context.registerBean(ObjectMapper.class);
        context.register(SupportAiModelConfig.class, OllamaSupportLocalModelClient.class);
        context.refresh();
        return context;
    }

    private Object field(Object target, String name) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }
}
