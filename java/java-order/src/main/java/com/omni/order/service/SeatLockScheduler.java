package com.omni.order.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SeatLockScheduler {

    private final OrderService orderService;

    public SeatLockScheduler(OrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(fixedDelay = 60_000)
    public void releaseExpiredSeatLocks() {
        orderService.releaseExpiredSeatLocks();
    }
}
