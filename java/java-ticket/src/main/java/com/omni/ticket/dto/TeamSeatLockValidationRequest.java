package com.omni.ticket.dto;

import java.util.List;

public class TeamSeatLockValidationRequest {
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private String lockRequestId;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
    public String getLockRequestId() { return lockRequestId; }
    public void setLockRequestId(String lockRequestId) { this.lockRequestId = lockRequestId; }
}
