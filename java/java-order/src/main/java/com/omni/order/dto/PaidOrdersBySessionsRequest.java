package com.omni.order.dto;

import java.util.List;

public class PaidOrdersBySessionsRequest {

    private List<Long> sessionIds;
    private Boolean paidOnly = true;

    public List<Long> getSessionIds() {
        return sessionIds;
    }

    public void setSessionIds(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }

    public Boolean getPaidOnly() { return paidOnly; }
    public void setPaidOnly(Boolean paidOnly) { this.paidOnly = paidOnly; }
}
