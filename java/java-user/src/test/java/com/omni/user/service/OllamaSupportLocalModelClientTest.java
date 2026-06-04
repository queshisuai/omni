package com.omni.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OllamaSupportLocalModelClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void callsOpenAiCompatibleGatewayAndReadsChoiceMessage() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"网关模型回答\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://localhost:" + server.getAddress().getPort() + "/v1/chat/completions";
            OllamaSupportLocalModelClient client = new OllamaSupportLocalModelClient(
                    true,
                    endpoint,
                    "Qwen3-4B-AWQ",
                    2000,
                    HttpClient.newHttpClient(),
                    objectMapper
            );

            Optional<String> answer = client.answer("票夹在哪里？", "平台规则：票夹和人工客服");

            assertEquals(Optional.of("网关模型回答"), answer);
            JsonNode root = objectMapper.readTree(requestBody.get());
            assertEquals("Qwen3-4B-AWQ", root.path("model").asText());
            assertFalse(root.path("stream").asBoolean(true));
            assertEquals("平台规则：票夹和人工客服", root.path("messages").get(0).path("content").asText());
            assertEquals("票夹在哪里？", root.path("messages").get(1).path("content").asText());
        } finally {
            server.stop(0);
        }
    }

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
    void fallsBackToBufferedModelAnswerWhenStreamingIsUnsupported() throws Exception {
        AtomicInteger requestCount = new AtomicInteger();
        List<String> requestBodies = new CopyOnWriteArrayList<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            int count = requestCount.incrementAndGet();
            requestBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = (count == 1
                    ? "{\"detail\":\"streaming is not supported by this lightweight service\"}"
                    : "{\"choices\":[{\"message\":{\"content\":\"模型普通回复也要分段推送\"}}]}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(count == 1 ? 400 : 200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://localhost:" + server.getAddress().getPort() + "/v1/chat/completions";
            OllamaSupportLocalModelClient client = new OllamaSupportLocalModelClient(
                    true,
                    endpoint,
                    "Qwen3-4B-AWQ",
                    2000,
                    HttpClient.newHttpClient(),
                    objectMapper
            );
            StringBuilder streamed = new StringBuilder();

            Optional<String> answer = client.streamAnswer("票可以退吗？", "平台规则：退款看订单页", streamed::append);

            assertEquals(Optional.of("模型普通回复也要分段推送"), answer);
            assertEquals("模型普通回复也要分段推送", streamed.toString());
            assertEquals(2, requestCount.get());
            assertTrue(objectMapper.readTree(requestBodies.get(0)).path("stream").asBoolean(false));
            assertFalse(objectMapper.readTree(requestBodies.get(1)).path("stream").asBoolean(true));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void removesThinkingBlocksBeforeReturningAnswer() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"choices\":[{\"message\":{\"content\":\"<think>分析过程</think>请在我的票夹查看电子票。\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://localhost:" + server.getAddress().getPort() + "/v1/chat/completions";
            OllamaSupportLocalModelClient client = new OllamaSupportLocalModelClient(
                    true,
                    endpoint,
                    "Qwen3-4B-AWQ",
                    2000,
                    HttpClient.newHttpClient(),
                    objectMapper
            );

            Optional<String> answer = client.answer("票夹在哪里？", "平台规则");

            assertEquals(Optional.of("请在我的票夹查看电子票。"), answer);
            assertNotNull(requestBody.get());
        } finally {
            server.stop(0);
        }
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

    @Test
    void springDefaultTargetsLocalOllamaQwen25() throws Exception {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(ObjectMapper.class);
            context.register(OllamaSupportLocalModelClient.class);
            context.refresh();

            OllamaSupportLocalModelClient client = context.getBean(OllamaSupportLocalModelClient.class);

            assertEquals("http://localhost:11434/api/chat", readField(client, "endpoint"));
            assertEquals("Qwen2.5:7b", readField(client, "model"));
            assertEquals(30000, readField(client, "timeoutMillis"));
            assertEquals(true, readField(client, "enabled"));
        }
    }

    private Object readField(Object target, String fieldName) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        return field.get(target);
    }
}
