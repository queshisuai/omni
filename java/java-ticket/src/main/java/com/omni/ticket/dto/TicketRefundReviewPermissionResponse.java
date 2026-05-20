package com.omni.ticket.dto;

public class TicketRefundReviewPermissionResponse {
    private Boolean allowed;
    private Long sessionId;
    private Long activityId;
    private Long organizerId;
    private String reason;

    public Boolean getAllowed() { return allowed; }
    public void setAllowed(Boolean allowed) { this.allowed = allowed; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
