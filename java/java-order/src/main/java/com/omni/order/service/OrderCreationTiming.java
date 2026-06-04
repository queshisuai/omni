package com.omni.order.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;
import java.util.function.LongSupplier;

final class OrderCreationTiming {
    private static final long NANOS_PER_MILLISECOND = 1_000_000L;

    private final LongSupplier ticker;
    private final long startNanos;
    private long previousNanos;
    private final Map<String, Long> stageDurations = new LinkedHashMap<>();

    private OrderCreationTiming(LongSupplier ticker) {
        this.ticker = ticker;
        this.startNanos = ticker.getAsLong();
        this.previousNanos = startNanos;
    }

    static OrderCreationTiming start() {
        return start(System::nanoTime);
    }

    static OrderCreationTiming start(LongSupplier ticker) {
        return new OrderCreationTiming(ticker);
    }

    void mark(String stage) {
        long now = ticker.getAsLong();
        stageDurations.put(stage, toMillis(now - previousNanos));
        previousNanos = now;
    }

    String summary(String flow,
                   String grabRequestId,
                   Long orderId,
                   Long userId,
                   Long sessionId,
                   Long ticketTypeId,
                   Integer quantity) {
        StringJoiner summary = new StringJoiner(", ");
        summary.add("flow=" + flow);
        summary.add("grabRequestId=" + value(grabRequestId));
        summary.add("orderId=" + value(orderId));
        summary.add("userId=" + value(userId));
        summary.add("sessionId=" + value(sessionId));
        summary.add("ticketTypeId=" + value(ticketTypeId));
        summary.add("quantity=" + value(quantity));
        stageDurations.forEach((stage, millis) -> summary.add(stage + "Ms=" + millis));
        summary.add("totalMs=" + toMillis(ticker.getAsLong() - startNanos));
        return summary.toString();
    }

    private static long toMillis(long nanos) {
        return Math.max(0L, nanos / NANOS_PER_MILLISECOND);
    }

    private static String value(Object value) {
        return value == null ? "-" : String.valueOf(value);
    }
}
