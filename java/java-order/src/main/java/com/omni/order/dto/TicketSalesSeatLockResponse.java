package com.omni.order.dto;

import java.util.List;

public class TicketSalesSeatLockResponse {
    private Boolean valid;
    private List<Long> seatIds;
    private List<Long> lockedSeatIds;
    private List<String> seatLabels;

    public Boolean getValid() { return valid; }
    public void setValid(Boolean valid) { this.valid = valid; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
    public List<Long> getLockedSeatIds() { return lockedSeatIds; }
    public void setLockedSeatIds(List<Long> lockedSeatIds) { this.lockedSeatIds = lockedSeatIds; }
    public List<String> getSeatLabels() { return seatLabels; }
    public void setSeatLabels(List<String> seatLabels) { this.seatLabels = seatLabels; }
}
