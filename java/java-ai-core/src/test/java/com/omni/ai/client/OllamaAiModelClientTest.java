package com.omni.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.omni.ai.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OllamaAiModelClientTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private HttpClient http;
    private HttpResponse<InputStream> response;
    private TrackingInputStream input;
    private HttpRequest sentRequest;
    private ByteArrayOutputStream sent;
    private OllamaAiModelClient client;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() throws Exception {
        http = mock(HttpClient.class);
        response = mock(HttpResponse.class);
        sent = new ByteArrayOutputStream();
        when(response.statusCode()).thenReturn(200);
        when(http.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(invocation -> {
            sentRequest = invocation.getArgument(0);
            sentRequest.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
                public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
                public void onNext(ByteBuffer item) {
                    byte[] bytes = new byte[item.remaining()];
                    item.get(bytes);
                    sent.write(bytes, 0, bytes.length);
                }
                public void onError(Throwable error) { fail(error); }
                public void onComplete() { }
            });
            return CompletableFuture.completedFuture(response);
        });
        body("{}");
        client = new OllamaAiModelClient(true, "http://localhost/api/chat", "configured-model", 1000, 2048,
                "test-key", mapper, http);
    }

    private AiRequest request() {
        return new AiRequest("request-1", null, "规则", List.of(new AiMessage("user", "问题")), null, null, null);
    }

    private void body(String body) throws Exception {
        input = new TrackingInputStream(body.getBytes(StandardCharsets.UTF_8));
        when(response.body()).thenReturn(input);
    }

    @Test
    void generatesUsingExistingPayloadAndReturnsMetadata() throws Exception {
        body("{\"model\":\"configured-model\",\"message\":{\"content\":\"<think>隐私</think>回答\"},\"done\":true,\"done_reason\":\"stop\",\"prompt_eval_count\":3,\"eval_count\":4}");
        AiResponse result = client.generate(request());
        assertEquals("回答", result.getText());
        assertEquals("request-1", result.getRequestId());
        assertEquals("stop", result.getFinishReason());
        assertEquals(7L, result.getUsage().getTotalTokens());
        assertTrue(result.getLatencyMillis() >= 0);
        JsonNode payload = mapper.readTree(sent.toByteArray());
        assertEquals("configured-model", payload.path("model").asText());
        assertEquals(2048, payload.path("options").path("num_ctx").asInt());
        assertEquals(2, payload.path("messages").size());
        assertFalse(payload.path("stream").asBoolean());
        assertFalse(payload.has("format"));
        assertEquals("Bearer test-key", sentRequest.headers().firstValue("Authorization").orElseThrow());
        assertTrue(input.closed);
    }

    @Test
    void sendsOptionalNativeJsonResponseFormatWithoutChangingLegacyFields() throws Exception {
        body("{\"response\":\"回答\"}");
        ObjectNode format = mapper.createObjectNode()
                .put("type", "object")
                .put("additionalProperties", false);
        AiRequest request = new AiRequest("request-2", null, "规则",
                List.of(new AiMessage("user", "问题")), null, null, null, format);

        client.generate(request);

        JsonNode payload = mapper.readTree(sent.toByteArray());
        assertEquals("object", payload.path("format").path("type").asText());
        assertFalse(payload.path("format").path("additionalProperties").asBoolean());
        assertFalse(payload.has("response_format"));
        assertEquals(2048, payload.path("options").path("num_ctx").asInt());
    }

    @Test
    void mapsRequestOptionsWithoutAddingDefaults() throws Exception {
        body("{\"response\":\"回答\"}");
        client.generate(new AiRequest(null, "override", null, List.of(new AiMessage("user", "问题")), 0.3, 99, 4096));
        JsonNode payload = mapper.readTree(sent.toByteArray());
        assertEquals("override", payload.path("model").asText());
        assertEquals(99, payload.path("options").path("num_predict").asInt());
        assertEquals(0.3, payload.path("options").path("temperature").asDouble());
        assertEquals(4096, payload.path("options").path("num_ctx").asInt());
        assertEquals(1, payload.path("messages").size());
    }

    @Test
    void readsSseMetadataMultilineEventsAndUsage() throws Exception {
        body(": heartbeat\nevent: message\nid: 1\ndata: {\"choices\":\ndata: [{\"delta\":{\"content\":\"你好\"}}]}\n\n"
                + "data: {\"choices\":[{\"delta\":{\"content\":\"世界\"},\"finish_reason\":\"stop\"}]}\n\n"
                + "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":2,\"completion_tokens\":3,\"total_tokens\":5}}\n\n"
                + "data: [DONE]\n\n");
        List<AiStreamChunk> chunks = new ArrayList<>();
        AiResponse response = client.stream(request(), chunks::add);
        assertEquals("你好世界", response.getText());
        assertEquals(5L, response.getUsage().getTotalTokens());
        assertEquals("stop", chunks.get(chunks.size() - 1).getFinishReason());
        assertEquals("你好世界", chunks.stream().map(AiStreamChunk::getText).reduce("", String::concat));
        for (int i = 0; i < chunks.size(); i++) assertEquals(i, chunks.get(i).getSequence());
    }

    @Test
    void filtersThinkTagsSplitAcrossNdjsonChunks() throws Exception {
        body("{\"message\":{\"content\":\"<thi\"}}\n{\"message\":{\"content\":\"nk>隐藏</th\"}}\n"
                + "{\"message\":{\"content\":\"ink>可见回答\"}}\n{\"done\":true,\"eval_count\":2}\n");
        StringBuilder text = new StringBuilder();
        assertEquals("可见回答", client.stream(request(), c -> text.append(c.getText())).getText());
        assertEquals("可见回答", text.toString());
    }

    @Test
    void unifiesHttpErrorsWithoutLeakingBody() throws Exception {
        when(response.statusCode()).thenReturn(503);
        AiModelException error = assertThrows(AiModelException.class, () -> client.generate(request()));
        assertEquals(AiErrorCode.HTTP_ERROR, error.getCode());
        assertEquals(503, error.getHttpStatus());
        assertNull(error.getCause());
        assertEquals(2, input.available());
        assertTrue(input.closed);
    }

    @Test
    void distinguishesJsonAndSseAndEmptyErrors() throws Exception {
        body("not-json-secret");
        assertEquals(AiErrorCode.JSON_ERROR, assertThrows(AiModelException.class, () -> client.generate(request())).getCode());
        body("data: not-json-secret\n\n");
        assertEquals(AiErrorCode.SSE_ERROR, assertThrows(AiModelException.class, () -> client.stream(request(), c -> {})).getCode());
        body("{\"message\":{\"content\":\"<think>隐藏</think>\"}}");
        assertEquals(AiErrorCode.EMPTY_RESULT, assertThrows(AiModelException.class, () -> client.generate(request())).getCode());
    }

    @Test
    void detectsTruncatedStreamAndProviderError() throws Exception {
        body("{\"message\":{\"content\":\"部分回答\"}}\n");
        assertEquals(AiErrorCode.SSE_ERROR, assertThrows(AiModelException.class, () -> client.stream(request(), c -> {})).getCode());
        body("{\"error\":\"secret provider failure\"}");
        assertEquals(AiErrorCode.UNAVAILABLE, assertThrows(AiModelException.class, () -> client.generate(request())).getCode());
    }

    @Test
    void mapsSocketTimeoutAndConnectionFailure() throws Exception {
        doReturn(CompletableFuture.failedFuture(new HttpTimeoutException("secret endpoint")))
                .when(http).sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        assertEquals(AiErrorCode.TIMEOUT, assertThrows(AiModelException.class, () -> client.generate(request())).getCode());
        doReturn(CompletableFuture.failedFuture(new IOException("secret credentials")))
                .when(http).sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        AiModelException error = assertThrows(AiModelException.class, () -> client.generate(request()));
        assertEquals(AiErrorCode.UNAVAILABLE, error.getCode());
        assertFalse(error.getMessage().contains("secret"));
    }

    @Test
    void preCancelledRequestDoesNotOpenConnection() {
        AiCancellationToken token = new AiCancellationToken();
        token.cancel();
        assertEquals(AiErrorCode.CANCELLED, assertThrows(AiModelException.class, () -> client.generate(request(), token)).getCode());
        verifyNoInteractions(http);
    }

    @Test
    void cancellationStopsChunksAndDisconnects() throws Exception {
        body("{\"message\":{\"content\":\"第一段内容足够长以产生可见输出\"}}\n{\"message\":{\"content\":\"不可发送\"}}\n{\"done\":true}\n");
        AiCancellationToken token = new AiCancellationToken();
        List<AiStreamChunk> chunks = new ArrayList<>();
        assertEquals(AiErrorCode.CANCELLED, assertThrows(AiModelException.class, () -> client.stream(request(), c -> {
            chunks.add(c);
            token.cancel();
        }, token)).getCode());
        assertEquals(1, chunks.size());
        assertTrue(input.closed);
    }

    @Test
    void cancellationReleasesBlockedRead() throws Exception {
        CountDownLatch reading = new CountDownLatch(1);
        CountDownLatch disconnected = new CountDownLatch(1);
        when(response.body()).thenReturn(new InputStream() {
            public int read() throws IOException {
                reading.countDown();
                try { if (!disconnected.await(3, TimeUnit.SECONDS)) throw new IOException("读取未被取消"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                throw new IOException("连接已关闭");
            }
            public void close() { disconnected.countDown(); }
        });
        AiCancellationToken token = new AiCancellationToken();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<AiErrorCode> result = executor.submit(() -> assertThrows(AiModelException.class,
                    () -> client.stream(request(), c -> {}, token)).getCode());
            assertTrue(reading.await(2, TimeUnit.SECONDS));
            token.cancel();
            assertEquals(AiErrorCode.CANCELLED, result.get(2, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }

    @Test
    void invalidRequestFailsBeforeNetwork() {
        assertEquals(AiErrorCode.INVALID_REQUEST, assertThrows(AiModelException.class,
                () -> client.generate(new AiRequest(null, null, null, List.of(), null, null, null))).getCode());
        verifyNoInteractions(http);
    }

    @Test
    void supplementaryUnicodeInRequestIdCannotBreakLogging() throws Exception {
        body("{\"response\":\"回答\"}");
        AiRequest request = new AiRequest("request-😀", null, null, List.of(new AiMessage("user", "问题")), null, null, null);
        assertEquals("request-😀", client.generate(request).getRequestId());
        body("broken");
        assertEquals(AiErrorCode.JSON_ERROR, assertThrows(AiModelException.class, () -> client.generate(request)).getCode());
    }

    @Test
    void nullRoleAndTrailingJsonAreRejected() throws Exception {
        assertEquals(AiErrorCode.INVALID_REQUEST, assertThrows(AiModelException.class,
                () -> client.generate(new AiRequest(null, null, null, List.of(new AiMessage(null, "问题")), null, null, null))).getCode());
        body("{\"response\":\"partial\"}\n{BROKEN");
        assertEquals(AiErrorCode.JSON_ERROR, assertThrows(AiModelException.class, () -> client.generate(request())).getCode());
    }

    private static final class TrackingInputStream extends ByteArrayInputStream {
        boolean closed;
        TrackingInputStream(byte[] bytes) { super(bytes); }
        @Override public void close() { closed = true; }
    }

    @Test
    void openAiEndpointMapsOptionalSamplingFieldsAndAcceptsBufferedStreamReply() throws Exception {
        client = new OllamaAiModelClient(true, "http://localhost/v1/chat/completions", "qwen", 1000, 2048, "", mapper, http);
        body("{\"choices\":[{\"message\":{\"content\":\"普通完整回复\"}}]}");
        AiRequest request = new AiRequest(null, null, "规则", List.of(new AiMessage("user", "问题")), 0.4, 123, null);
        assertEquals("普通完整回复", client.stream(request, c -> {}).getText());
        JsonNode payload = mapper.readTree(sent.toByteArray());
        assertEquals(0.4, payload.path("temperature").asDouble());
        assertEquals(123, payload.path("max_tokens").asInt());
        assertFalse(payload.path("options").has("num_predict"));
        assertEquals(2048, payload.path("options").path("num_ctx").asInt());
    }

    @Test
    void callbackErrorsAreSafeAndCloseResponse() throws Exception {
        body("{\"message\":{\"content\":\"足够长的一段模型输出内容\"}}\n{\"done\":true}\n");
        AiModelException error = assertThrows(AiModelException.class, () -> client.stream(request(), c -> {
            throw new IllegalStateException("secret-password");
        }));
        assertEquals(AiErrorCode.CALLBACK_ERROR, error.getCode());
        assertNull(error.getCause());
        assertFalse(error.getMessage().contains("secret"));
        assertTrue(input.closed);
    }

    @Test
    void observationsContainOnlyMetadata() throws Exception {
        ch.qos.logback.classic.Logger logger = (ch.qos.logback.classic.Logger)
                org.slf4j.LoggerFactory.getLogger(OllamaAiModelClient.class);
        ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> logs = new ch.qos.logback.core.read.ListAppender<>();
        logs.start();
        logger.addAppender(logs);
        try {
            body("{\"response\":\"private-response\"}");
            client.generate(new AiRequest("log-1", null, "private-system", List.of(new AiMessage("user", "private-user")), null, null, null));
            String log = logs.list.get(0).getFormattedMessage();
            assertTrue(log.contains("requestId=log-1"));
            assertTrue(log.contains("model=configured-model"));
            assertTrue(log.contains("success=true"));
            assertTrue(log.contains("stream=false"));
            assertTrue(log.contains("latencyMs="));
            assertFalse(log.contains("private-"));
            assertFalse(log.contains("test-key"));
            assertFalse(log.contains("localhost"));
        } finally { logger.detachAppender(logs); logs.stop(); }
    }
}
