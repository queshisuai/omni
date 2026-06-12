package com.omni.ticket.dto;

public class TicketPurchaseContextRequest {
    private Long sessionId;
    private Long ticketTypeId;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
}
