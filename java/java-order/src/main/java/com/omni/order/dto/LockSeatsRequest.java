package com.omni.order.dto;

import java.math.BigDecimal;
import java.util.List;

public class LockSeatsRequest {
    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private List<Long> seatIds;
    private BigDecimal unitPrice;
    private BigDecimal authorizedMaxUnitPrice;
    private String grabRequestId;
    private Long requestedTicketTypeId;
    private Long matchedTicketTypeId;
    private Boolean autoDowngraded;
    private List<Long> attendeeIds;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getAuthorizedMaxUnitPrice() { return authorizedMaxUnitPrice; }
    public void setAuthorizedMaxUnitPrice(BigDecimal authorizedMaxUnitPrice) { this.authorizedMaxUnitPrice = authorizedMaxUnitPrice; }
    public String getGrabRequestId() { return grabRequestId; }
    public void setGrabRequestId(String grabRequestId) { this.grabRequestId = grabRequestId; }
    public Long getRequestedTicketTypeId() { return requestedTicketTypeId; }
    public void setRequestedTicketTypeId(Long requestedTicketTypeId) { this.requestedTicketTypeId = requestedTicketTypeId; }
    public Long getMatchedTicketTypeId() { return matchedTicketTypeId; }
    public void setMatchedTicketTypeId(Long matchedTicketTypeId) { this.matchedTicketTypeId = matchedTicketTypeId; }
    public Boolean getAutoDowngraded() { return autoDowngraded; }
    public void setAutoDowngraded(Boolean autoDowngraded) { this.autoDowngraded = autoDowngraded; }
    public List<Long> getAttendeeIds() { return attendeeIds; }
    public void setAttendeeIds(List<Long> attendeeIds) { this.attendeeIds = attendeeIds; }
}
