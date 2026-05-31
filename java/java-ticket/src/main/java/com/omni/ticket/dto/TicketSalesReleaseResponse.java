package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class TicketSalesReleaseResponse {
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private Integer restoredQuantity;
    private List<Long> seatIds = new ArrayList<>();

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Integer getRestoredQuantity() { return restoredQuantity; }
    public void setRestoredQuantity(Integer restoredQuantity) { this.restoredQuantity = restoredQuantity; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
}
