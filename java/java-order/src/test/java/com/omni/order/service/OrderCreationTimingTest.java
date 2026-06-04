package com.omni.order.service;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderCreationTimingTest {

    @Test
    void summaryIncludesStageDurationsAndTotalDuration() {
        AtomicLong now = new AtomicLong(1_000_000L);
        OrderCreationTiming timing = OrderCreationTiming.start(now::get);

        now.addAndGet(12_000_000L);
        timing.mark("quote");
        now.addAndGet(3_000_000L);
        timing.mark("attendee");
        now.addAndGet(5_000_000L);
        timing.mark("lockSeats");
        now.addAndGet(7_000_000L);
        timing.mark("persist");

        String summary = timing.summary("createOrderWithSeats", "GRAB-1", 631L, 2004L, 3L, 9L, 1);

        assertTrue(summary.contains("flow=createOrderWithSeats"), summary);
        assertTrue(summary.contains("grabRequestId=GRAB-1"), summary);
        assertTrue(summary.contains("orderId=631"), summary);
        assertTrue(summary.contains("quoteMs=12"), summary);
        assertTrue(summary.contains("attendeeMs=3"), summary);
        assertTrue(summary.contains("lockSeatsMs=5"), summary);
        assertTrue(summary.contains("persistMs=7"), summary);
        assertTrue(summary.contains("totalMs=27"), summary);
    }
}
