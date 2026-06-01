package com.omni.order.dto;

public class TicketTransferClaimResponse {
    private Long transferId;
    private Long originalTicketId;
    private Long ticketId;
    private Integer status;
    private String statusText;

    public Long getTransferId() { return transferId; }
    public void setTransferId(Long transferId) { this.transferId = transferId; }
    public Long getOriginalTicketId() { return originalTicketId; }
    public void setOriginalTicketId(Long originalTicketId) { this.originalTicketId = originalTicketId; }
    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getStatusText() { return statusText; }
    public void setStatusText(String statusText) { this.statusText = statusText; }
}
