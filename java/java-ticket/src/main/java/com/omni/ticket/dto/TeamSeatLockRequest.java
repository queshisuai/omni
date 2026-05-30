package com.omni.ticket.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TeamSeatLockRequest {
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private String strategy;
    private List<String> fallbacks;
    private String lockRequestId;
    private LocalDateTime lockExpireTime;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }
    public List<String> getFallbacks() { return fallbacks; }
    public void setFallbacks(List<String> fallbacks) { this.fallbacks = fallbacks; }
    public String getLockRequestId() { return lockRequestId; }
    public void setLockRequestId(String lockRequestId) { this.lockRequestId = lockRequestId; }
    public LocalDateTime getLockExpireTime() { return lockExpireTime; }
    public void setLockExpireTime(LocalDateTime lockExpireTime) { this.lockExpireTime = lockExpireTime; }
}
