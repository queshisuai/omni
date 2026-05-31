package com.omni.order.service;

import com.omni.order.dto.TicketReleasedEvent;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SeatLockScheduler {

    private final OrderService orderService;

    public SeatLockScheduler(OrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(fixedDelay = 60_000)
    public void releaseExpiredSeatLocks() {
        List<TicketReleasedEvent> events = orderService.releaseExpiredSeatLocksDetailed();
        orderService.publishWaitlistReleaseEvents(events);
    }
}
