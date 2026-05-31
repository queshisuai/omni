package com.omni.order.service;

import com.omni.order.dto.TicketReleasedEvent;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class SeatLockSchedulerTest {

    @Test
    void releaseExpiredSeatLocksPublishesDetailedEvents() {
        OrderService orderService = mock(OrderService.class);
        TicketReleasedEvent event = new TicketReleasedEvent();
        event.setEventKey("order-timeout:1:session:101:ticket-type:202");
        when(orderService.releaseExpiredSeatLocksDetailed()).thenReturn(List.of(event));
        SeatLockScheduler scheduler = new SeatLockScheduler(orderService);

        scheduler.releaseExpiredSeatLocks();

        verify(orderService).releaseExpiredSeatLocksDetailed();
        verify(orderService).publishWaitlistReleaseEvents(List.of(event));
    }
}
