package com.omni.ticket.dto;

public class ActivityReviewStatusRequest {
    private Integer status;
    private String reason;

    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
