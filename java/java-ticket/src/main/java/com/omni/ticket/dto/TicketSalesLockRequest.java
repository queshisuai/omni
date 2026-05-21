package com.omni.ticket.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TicketSalesLockRequest {
    private Long orderId;
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private Integer quantity;
    private LocalDateTime lockExpireTime;
    private Boolean allocateRandom;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public LocalDateTime getLockExpireTime() { return lockExpireTime; }
    public void setLockExpireTime(LocalDateTime lockExpireTime) { this.lockExpireTime = lockExpireTime; }
    public Boolean getAllocateRandom() { return allocateRandom; }
    public void setAllocateRandom(Boolean allocateRandom) { this.allocateRandom = allocateRandom; }
}
