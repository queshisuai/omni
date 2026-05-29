package com.omni.ticket.dto;

import java.util.List;

public class TicketTypesVisibleRequest {
    private Long sessionId;
    private List<Long> ticketTypeIds;

    public Long getSessionId() {
        return sessionId;
    }

    public void setSessionId(Long sessionId) {
        this.sessionId = sessionId;
    }

    public List<Long> getTicketTypeIds() {
        return ticketTypeIds;
    }

    public void setTicketTypeIds(List<Long> ticketTypeIds) {
        this.ticketTypeIds = ticketTypeIds;
    }
}
