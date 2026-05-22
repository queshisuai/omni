package com.omni.ticket.dto;

import java.util.List;

public class SessionSeatUsageResponse {
    private List<SessionSeatUsageItemResponse> seats;

    public SessionSeatUsageResponse() {
    }

    public SessionSeatUsageResponse(List<SessionSeatUsageItemResponse> seats) {
        this.seats = seats;
    }

    public List<SessionSeatUsageItemResponse> getSeats() {
        return seats;
    }

    public void setSeats(List<SessionSeatUsageItemResponse> seats) {
        this.seats = seats;
    }
}
