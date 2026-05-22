package com.omni.order.dto;

import java.util.List;

public class SessionSeatUsageRequest {
    private List<Long> sessionSeatIds;

    public List<Long> getSessionSeatIds() {
        return sessionSeatIds;
    }

    public void setSessionSeatIds(List<Long> sessionSeatIds) {
        this.sessionSeatIds = sessionSeatIds;
    }
}
