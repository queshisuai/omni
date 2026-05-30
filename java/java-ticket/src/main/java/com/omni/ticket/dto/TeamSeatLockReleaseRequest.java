package com.omni.ticket.dto;

import java.util.List;

public class TeamSeatLockReleaseRequest {
    private String lockRequestId;
    private List<Long> seatIds;

    public String getLockRequestId() { return lockRequestId; }
    public void setLockRequestId(String lockRequestId) { this.lockRequestId = lockRequestId; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
}
