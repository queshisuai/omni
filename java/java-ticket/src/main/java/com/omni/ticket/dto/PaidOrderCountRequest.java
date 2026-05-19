package com.omni.ticket.dto;

import java.util.List;

public class PaidOrderCountRequest {

    private List<Long> sessionIds;

    public PaidOrderCountRequest() {
    }

    public PaidOrderCountRequest(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }

    public List<Long> getSessionIds() {
        return sessionIds;
    }

    public void setSessionIds(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }
}
