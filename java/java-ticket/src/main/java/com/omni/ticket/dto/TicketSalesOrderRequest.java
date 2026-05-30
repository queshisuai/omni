package com.omni.ticket.dto;

import java.util.List;

public class TicketSalesOrderRequest {
    private Long orderId;
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private Integer quantity;
    private String lockRequestId;

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
    public String getLockRequestId() { return lockRequestId; }
    public void setLockRequestId(String lockRequestId) { this.lockRequestId = lockRequestId; }
}
