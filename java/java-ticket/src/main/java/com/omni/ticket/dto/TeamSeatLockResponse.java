package com.omni.ticket.dto;

import java.util.List;

public class TeamSeatLockResponse {
    private List<Long> lockedSeatIds;
    private List<String> seatLabels;
    private String matchedStrategy;

    public List<Long> getLockedSeatIds() { return lockedSeatIds; }
    public void setLockedSeatIds(List<Long> lockedSeatIds) { this.lockedSeatIds = lockedSeatIds; }
    public List<String> getSeatLabels() { return seatLabels; }
    public void setSeatLabels(List<String> seatLabels) { this.seatLabels = seatLabels; }
    public String getMatchedStrategy() { return matchedStrategy; }
    public void setMatchedStrategy(String matchedStrategy) { this.matchedStrategy = matchedStrategy; }
}
