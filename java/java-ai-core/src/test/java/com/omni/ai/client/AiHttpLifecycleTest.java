package com.omni.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.dto.AiMessage;
import com.omni.ai.dto.AiRequest;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class AiHttpLifecycleTest {
    private AiRequest request() {
        return new AiRequest(null, null, "规则", List.of(new AiMessage("user", "问题")), null, null, null);
    }

    @Test
    void cancelsActualChunkedSocketWithoutWaitingForReadTimeout() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        CountDownLatch releaseServer = new CountDownLatch(1);
        CountDownLatch visible = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        server.createContext("/api/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write("{\"message\":{\"content\":\"首段内容足够长以产生可见文本\"}}\n".getBytes(StandardCharsets.UTF_8));
            exchange.getResponseBody().flush();
            try { releaseServer.await(8, TimeUnit.SECONDS); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            AiModelClient client = new OllamaAiModelClient(true,
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/api/chat", "qwen", 6000, 2048, "", new ObjectMapper());
            AiCancellationToken token = new AiCancellationToken();
            Future<AiErrorCode> result = executor.submit(() -> assertThrows(AiModelException.class,
                    () -> client.stream(request(), c -> visible.countDown(), token)).getCode());
            assertTrue(visible.await(3, TimeUnit.SECONDS));
            // 让调用线程进入下一次阻塞 read；取消必须在 6 秒读取超时前返回。
            Thread.sleep(100);
            Future<?> cancellation = executor.submit(token::cancel);
            cancellation.get(1, TimeUnit.SECONDS);
            assertEquals(AiErrorCode.CANCELLED, result.get(1, TimeUnit.SECONDS));
        } finally {
            releaseServer.countDown();
            server.stop(0);
            executor.shutdownNow();
        }
    }

    @Test
    void overallDeadlineStopsContinuousStreaming() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, 0);
            try {
                for (int i = 0; i < 40; i++) {
                    exchange.getResponseBody().write("{\"message\":{\"content\":\"持续输出\"}}\n".getBytes(StandardCharsets.UTF_8));
                    exchange.getResponseBody().flush();
                    Thread.sleep(80);
                }
            } catch (Exception ignored) { }
            finally { exchange.close(); }
        });
        server.start();
        try {
            AiModelClient client = new OllamaAiModelClient(true,
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/api/chat", "qwen", 1000, 2048, "", new ObjectMapper());
            long started = System.nanoTime();
            assertEquals(AiErrorCode.TIMEOUT, assertThrows(AiModelException.class, () -> client.stream(request(), c -> {})).getCode());
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 2200);
        } finally { server.stop(0); }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cancelsBeforeHeadersForBothCallModes(boolean stream) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        CountDownLatch received = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        server.createContext("/api/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            received.countDown();
            try { release.await(5, TimeUnit.SECONDS); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            AiModelClient client = new OllamaAiModelClient(true,
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/api/chat", "qwen", 6000, 2048, "", new ObjectMapper());
            AiCancellationToken token = new AiCancellationToken();
            Future<AiErrorCode> result = executor.submit(() -> assertThrows(AiModelException.class, () -> {
                if (stream) client.stream(request(), c -> {}, token);
                else client.generate(request(), token);
            }).getCode());
            assertTrue(received.await(3, TimeUnit.SECONDS));
            token.cancel();
            assertEquals(AiErrorCode.CANCELLED, result.get(1, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            server.stop(0);
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentDeadlinesDoNotWaitForAnotherBlockedBody() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService serverExecutor = Executors.newFixedThreadPool(2);
        ExecutorService callers = Executors.newFixedThreadPool(2);
        CountDownLatch received = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        server.setExecutor(serverExecutor);
        server.createContext("/api/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write("{\"message\":{\"content\":\"足够长的初始分块输出文本\"}}\n".getBytes(StandardCharsets.UTF_8));
            exchange.getResponseBody().flush();
            received.countDown();
            try { release.await(5, TimeUnit.SECONDS); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            AiModelClient client = new OllamaAiModelClient(true,
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/api/chat", "qwen", 1200, 2048, "", new ObjectMapper());
            Callable<AiErrorCode> invoke = () -> assertThrows(AiModelException.class, () -> client.stream(request(), c -> {})).getCode();
            Future<AiErrorCode> first = callers.submit(invoke);
            Future<AiErrorCode> second = callers.submit(invoke);
            assertTrue(received.await(2, TimeUnit.SECONDS));
            assertEquals(AiErrorCode.TIMEOUT, first.get(2, TimeUnit.SECONDS));
            assertEquals(AiErrorCode.TIMEOUT, second.get(1, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            server.stop(0);
            serverExecutor.shutdownNow();
            callers.shutdownNow();
        }
    }
}
