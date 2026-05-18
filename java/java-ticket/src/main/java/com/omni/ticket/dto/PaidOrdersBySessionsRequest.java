package com.omni.ticket.dto;

import java.util.List;

public class PaidOrdersBySessionsRequest {

    private List<Long> sessionIds;

    public PaidOrdersBySessionsRequest() {
    }

    public PaidOrdersBySessionsRequest(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }

    public List<Long> getSessionIds() {
        return sessionIds;
    }

    public void setSessionIds(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }
}
