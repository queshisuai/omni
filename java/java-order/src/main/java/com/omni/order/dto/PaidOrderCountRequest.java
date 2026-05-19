package com.omni.order.dto;

import java.util.List;

public class PaidOrderCountRequest {

    private List<Long> sessionIds;

    public List<Long> getSessionIds() {
        return sessionIds;
    }

    public void setSessionIds(List<Long> sessionIds) {
        this.sessionIds = sessionIds;
    }
}
