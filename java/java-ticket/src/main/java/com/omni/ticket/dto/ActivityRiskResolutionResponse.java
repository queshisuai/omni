package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class ActivityRiskResolutionResponse {
    private Long id;
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private Long organizerId;
    private Long riskArtistId;
    private String status;
    private String riskSuspendedReason;
    private LocalDateTime riskSuspendedAt;
    private String resolutionNote;
    private String reviewNote;
    private Long submittedBy;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getActivityPoster() { return activityPoster; }
    public void setActivityPoster(String activityPoster) { this.activityPoster = activityPoster; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public Long getRiskArtistId() { return riskArtistId; }
    public void setRiskArtistId(Long riskArtistId) { this.riskArtistId = riskArtistId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRiskSuspendedReason() { return riskSuspendedReason; }
    public void setRiskSuspendedReason(String riskSuspendedReason) { this.riskSuspendedReason = riskSuspendedReason; }
    public LocalDateTime getRiskSuspendedAt() { return riskSuspendedAt; }
    public void setRiskSuspendedAt(LocalDateTime riskSuspendedAt) { this.riskSuspendedAt = riskSuspendedAt; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Long getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(Long submittedBy) { this.submittedBy = submittedBy; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
