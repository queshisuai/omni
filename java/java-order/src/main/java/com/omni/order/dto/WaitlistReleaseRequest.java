package com.omni.order.dto;

import java.util.ArrayList;
import java.util.List;

public class WaitlistReleaseRequest {
    private String eventKey;
    private String source;
    private Long sourceOrderId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private List<Long> seatIds = new ArrayList<>();

    public WaitlistReleaseRequest() {}

    public WaitlistReleaseRequest(TicketReleasedEvent event) {
        this.eventKey = event.getEventKey();
        this.source = event.getSource();
        this.sourceOrderId = event.getSourceOrderId();
        this.sessionId = event.getSessionId();
        this.ticketTypeId = event.getTicketTypeId();
        this.quantity = event.getQuantity();
        this.seatIds = event.getSeatIds();
    }

    public String getEventKey() { return eventKey; }
    public void setEventKey(String eventKey) { this.eventKey = eventKey; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Long getSourceOrderId() { return sourceOrderId; }
    public void setSourceOrderId(Long sourceOrderId) { this.sourceOrderId = sourceOrderId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
}
