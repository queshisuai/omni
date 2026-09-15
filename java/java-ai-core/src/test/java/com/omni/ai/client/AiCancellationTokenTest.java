package com.omni.ai.client;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiCancellationTokenTest {
    @Test
    void cancelIsIdempotentAndUnregisteredListenersAreReleased() throws Exception {
        AiCancellationToken token = new AiCancellationToken();
        AtomicInteger calls = new AtomicInteger();
        token.register(() -> { throw new IllegalStateException(); });
        token.register(calls::incrementAndGet);
        token.register(() -> calls.addAndGet(100)).close();
        token.cancel();
        token.cancel();
        assertEquals(1, calls.get());
        token.register(calls::incrementAndGet);
        assertEquals(2, calls.get());
    }

    @Test
    void cancellationBeforeHeadersCancelsFuture() {
        CompletableFuture<HttpResponse<InputStream>> future = new CompletableFuture<>();
        AiHttpCall call = new AiHttpCall(future);
        call.close();
        assertTrue(future.isCancelled());
    }

    @Test
    @SuppressWarnings("unchecked")
    void bodyArrivingAfterCloseIsStillReleased() {
        // 模拟无法取消、已经开始交付响应头的请求。
        CompletableFuture<HttpResponse<InputStream>> future = new CompletableFuture<>() {
            @Override public boolean cancel(boolean interrupt) { return false; }
        };
        AiHttpCall call = new AiHttpCall(future);
        call.close();
        AtomicInteger closes = new AtomicInteger();
        InputStream body = new ByteArrayInputStream(new byte[0]) {
            @Override public void close() { closes.incrementAndGet(); }
        };
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        when(response.body()).thenReturn(body);
        future.complete(response);
        call.close();
        assertEquals(1, closes.get());
    }
}
