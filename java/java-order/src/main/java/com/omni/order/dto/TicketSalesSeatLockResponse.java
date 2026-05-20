package com.omni.order.dto;

import java.util.List;

public class TicketSalesSeatLockResponse {
    private List<Long> lockedSeatIds;

    public List<Long> getLockedSeatIds() { return lockedSeatIds; }
    public void setLockedSeatIds(List<Long> lockedSeatIds) { this.lockedSeatIds = lockedSeatIds; }
}
