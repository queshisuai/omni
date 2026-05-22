package com.omni.order.dto;

public class RefundSeatOptionResponse {
    private Long orderSeatId;
    private Long sessionSeatId;
    private Long sessionId;
    private Long ticketTypeId;
    private String seatLabel;

    public Long getOrderSeatId() { return orderSeatId; }
    public void setOrderSeatId(Long orderSeatId) { this.orderSeatId = orderSeatId; }
    public Long getSessionSeatId() { return sessionSeatId; }
    public void setSessionSeatId(Long sessionSeatId) { this.sessionSeatId = sessionSeatId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getSeatLabel() { return seatLabel; }
    public void setSeatLabel(String seatLabel) { this.seatLabel = seatLabel; }
}
