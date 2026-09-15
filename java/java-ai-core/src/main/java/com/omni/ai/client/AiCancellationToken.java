package com.omni.ai.client;

import java.util.ArrayList;
import java.util.List;

/** 可从另一线程取消。一个信号对应一次调用，注册在调用结束时释放。 */
public final class AiCancellationToken {
    private boolean cancelled;
    private final List<Runnable> listeners = new ArrayList<>();

    public synchronized boolean isCancelled() { return cancelled; }

    public void cancel() {
        List<Runnable> callbacks;
        synchronized (this) {
            if (cancelled) return;
            cancelled = true;
            callbacks = new ArrayList<>(listeners);
            listeners.clear();
        }
        for (Runnable callback : callbacks) runSafely(callback);
    }

    AutoCloseable register(Runnable listener) {
        synchronized (this) {
            if (!cancelled) {
                listeners.add(listener);
                return () -> { synchronized (this) { listeners.remove(listener); } };
            }
        }
        runSafely(listener);
        return () -> {};
    }

    private void runSafely(Runnable callback) {
        try { callback.run(); } catch (RuntimeException ignored) { /* 取消不得暴露底层错误。 */ }
    }
}
