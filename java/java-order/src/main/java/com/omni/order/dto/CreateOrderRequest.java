package com.omni.order.dto;

/**
 * 创建订单请求
 */
public class CreateOrderRequest {

    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private java.math.BigDecimal unitPrice;
    private java.math.BigDecimal authorizedMaxUnitPrice;
    private String grabRequestId;
    private Long requestedTicketTypeId;
    private Long matchedTicketTypeId;
    private Boolean autoDowngraded;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public java.math.BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(java.math.BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public java.math.BigDecimal getAuthorizedMaxUnitPrice() { return authorizedMaxUnitPrice; }
    public void setAuthorizedMaxUnitPrice(java.math.BigDecimal authorizedMaxUnitPrice) { this.authorizedMaxUnitPrice = authorizedMaxUnitPrice; }
    public String getGrabRequestId() { return grabRequestId; }
    public void setGrabRequestId(String grabRequestId) { this.grabRequestId = grabRequestId; }
    public Long getRequestedTicketTypeId() { return requestedTicketTypeId; }
    public void setRequestedTicketTypeId(Long requestedTicketTypeId) { this.requestedTicketTypeId = requestedTicketTypeId; }
    public Long getMatchedTicketTypeId() { return matchedTicketTypeId; }
    public void setMatchedTicketTypeId(Long matchedTicketTypeId) { this.matchedTicketTypeId = matchedTicketTypeId; }
    public Boolean getAutoDowngraded() { return autoDowngraded; }
    public void setAutoDowngraded(Boolean autoDowngraded) { this.autoDowngraded = autoDowngraded; }
}
