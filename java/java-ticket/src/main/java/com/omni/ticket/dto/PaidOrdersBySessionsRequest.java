package com.omni.ticket.dto;

import java.util.List;

public class PaidOrdersBySessionsRequest {

    private List<Long> sessionIds;
    private Boolean paidOnly = true;

    public PaidOrdersBySessionsRequest() {
    }

    public PaidOrdersBySessionsRequest(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }

    public PaidOrdersBySessionsRequest(List<Long> sessionIds, Boolean paidOnly) {
        this.sessionIds = sessionIds;
        this.paidOnly = paidOnly;
    }

    public List<Long> getSessionIds() {
        return sessionIds;
    }

    public void setSessionIds(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }

    public Boolean getPaidOnly() { return paidOnly; }
    public void setPaidOnly(Boolean paidOnly) { this.paidOnly = paidOnly; }
}
