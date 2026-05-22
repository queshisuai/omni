package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class ActivityRiskCaseResponse {
    private Long activityId;
    private String activityName;
    private Long organizerId;
    private String riskSuspendedReason;
    private LocalDateTime riskSuspendedAt;
    private Long latestResolutionId;
    private String latestResolutionStatus;
    private String latestResolutionNote;
    private Long latestSubmittedBy;

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getRiskSuspendedReason() { return riskSuspendedReason; }
    public void setRiskSuspendedReason(String riskSuspendedReason) { this.riskSuspendedReason = riskSuspendedReason; }
    public LocalDateTime getRiskSuspendedAt() { return riskSuspendedAt; }
    public void setRiskSuspendedAt(LocalDateTime riskSuspendedAt) { this.riskSuspendedAt = riskSuspendedAt; }
    public Long getLatestResolutionId() { return latestResolutionId; }
    public void setLatestResolutionId(Long latestResolutionId) { this.latestResolutionId = latestResolutionId; }
    public String getLatestResolutionStatus() { return latestResolutionStatus; }
    public void setLatestResolutionStatus(String latestResolutionStatus) { this.latestResolutionStatus = latestResolutionStatus; }
    public String getLatestResolutionNote() { return latestResolutionNote; }
    public void setLatestResolutionNote(String latestResolutionNote) { this.latestResolutionNote = latestResolutionNote; }
    public Long getLatestSubmittedBy() { return latestSubmittedBy; }
    public void setLatestSubmittedBy(Long latestSubmittedBy) { this.latestSubmittedBy = latestSubmittedBy; }
}
