package com.omni.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OllamaSupportLocalModelClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void callsLocalModelWithProjectKnowledgeAndQuestion() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/chat", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"message\":{\"content\":\"本地模型回答\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://localhost:" + server.getAddress().getPort() + "/api/chat";
            OllamaSupportLocalModelClient client = new OllamaSupportLocalModelClient(
                    true,
                    endpoint,
                    "qwen-local",
                    2000,
                    HttpClient.newHttpClient(),
                    objectMapper
            );

            Optional<String> answer = client.answer("票夹在哪里？", "平台规则：票夹和人工客服");

            assertEquals(Optional.of("本地模型回答"), answer);
            JsonNode root = objectMapper.readTree(requestBody.get());
            assertEquals("qwen-local", root.path("model").asText());
            assertFalse(root.path("stream").asBoolean(true));
            assertEquals("平台规则：票夹和人工客服", root.path("messages").get(0).path("content").asText());
            assertEquals("票夹在哪里？", root.path("messages").get(1).path("content").asText());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void returnsEmptyWhenLocalModelIsDisabled() {
        OllamaSupportLocalModelClient client = new OllamaSupportLocalModelClient(
                false,
                "http://localhost:9/api/chat",
                "qwen-local",
                2000,
                HttpClient.newHttpClient(),
                objectMapper
        );

        assertTrue(client.answer("票夹在哪里？", "平台规则").isEmpty());
    }

    @Test
    void springCanCreateClientBeanWithoutDefaultConstructor() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(ObjectMapper.class);
            context.register(OllamaSupportLocalModelClient.class);
            context.refresh();

            assertNotNull(context.getBean(SupportLocalModelClient.class));
        }
    }
}
