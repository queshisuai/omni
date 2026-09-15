package com.omni.ai.client;

import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;

/** 关闭原始 HTTP body 以唤醒阻塞读取；不关闭持有读取锁的 Reader。 */
final class AiHttpCall {
    final CompletableFuture<HttpResponse<InputStream>> response;
    private InputStream body;
    private boolean closed;

    AiHttpCall(CompletableFuture<HttpResponse<InputStream>> response) {
        this.response = response;
        response.thenAccept(reply -> attach(reply.body()));
    }

    private void attach(InputStream input) {
        boolean closeImmediately;
        synchronized (this) {
            closeImmediately = closed;
            if (!closed) body = input;
        }
        if (closeImmediately) closeBody(input);
    }

    void close() {
        InputStream input;
        synchronized (this) {
            if (closed) return;
            closed = true;
            input = body;
            body = null;
        }
        response.cancel(true);
        closeBody(input);
    }

    private void closeBody(InputStream input) {
        if (input == null) return;
        try { input.close(); } catch (IOException ignored) { /* 不暴露模型连接信息。 */ }
    }
}
