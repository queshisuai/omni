package com.omni.order.dto;

import java.util.List;

public class TicketSalesSeatLockResponse {
    private List<Long> lockedSeatIds;
    private List<String> seatLabels;

    public List<Long> getLockedSeatIds() { return lockedSeatIds; }
    public void setLockedSeatIds(List<Long> lockedSeatIds) { this.lockedSeatIds = lockedSeatIds; }
    public List<String> getSeatLabels() { return seatLabels; }
    public void setSeatLabels(List<String> seatLabels) { this.seatLabels = seatLabels; }
}
