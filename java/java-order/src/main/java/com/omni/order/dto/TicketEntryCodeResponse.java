package com.omni.order.dto;

import java.time.LocalDateTime;

public class TicketEntryCodeResponse {
    private Long ticketId;
    private String entryCode;
    private LocalDateTime expiresAt;

    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public String getEntryCode() { return entryCode; }
    public void setEntryCode(String entryCode) { this.entryCode = entryCode; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
