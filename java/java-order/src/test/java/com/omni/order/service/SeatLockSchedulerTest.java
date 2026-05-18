package com.omni.order.service;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SeatLockSchedulerTest {

    @Test
    void releaseExpiredSeatLocksDelegatesToOrderService() {
        OrderService orderService = mock(OrderService.class);
        SeatLockScheduler scheduler = new SeatLockScheduler(orderService);

        scheduler.releaseExpiredSeatLocks();

        verify(orderService).releaseExpiredSeatLocks();
    }
}
