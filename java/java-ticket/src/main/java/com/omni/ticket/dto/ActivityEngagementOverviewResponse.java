package com.omni.ticket.dto;

public class ActivityEngagementOverviewResponse {
    private Long targetId;
    private String targetType;
    private String activityName;
    private String poster;
    private Long organizerId;
    private String organizerName;
    private Long pendingReviewCount;
    private Long publishedReviewCount;
    private Long hiddenReviewCount;
    private Long totalReviewCount;
    private Long pendingQuestionCount;
    private Long answeredQuestionCount;
    private Long hiddenQuestionCount;
    private Long totalQuestionCount;
    private Long pendingReportCount;
    private Long totalReportCount;
    private Double averageRating;

    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getPoster() { return poster; }
    public void setPoster(String poster) { this.poster = poster; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
    public Long getPendingReviewCount() { return pendingReviewCount; }
    public void setPendingReviewCount(Long pendingReviewCount) { this.pendingReviewCount = pendingReviewCount; }
    public Long getPublishedReviewCount() { return publishedReviewCount; }
    public void setPublishedReviewCount(Long publishedReviewCount) { this.publishedReviewCount = publishedReviewCount; }
    public Long getHiddenReviewCount() { return hiddenReviewCount; }
    public void setHiddenReviewCount(Long hiddenReviewCount) { this.hiddenReviewCount = hiddenReviewCount; }
    public Long getTotalReviewCount() { return totalReviewCount; }
    public void setTotalReviewCount(Long totalReviewCount) { this.totalReviewCount = totalReviewCount; }
    public Long getPendingQuestionCount() { return pendingQuestionCount; }
    public void setPendingQuestionCount(Long pendingQuestionCount) { this.pendingQuestionCount = pendingQuestionCount; }
    public Long getAnsweredQuestionCount() { return answeredQuestionCount; }
    public void setAnsweredQuestionCount(Long answeredQuestionCount) { this.answeredQuestionCount = answeredQuestionCount; }
    public Long getHiddenQuestionCount() { return hiddenQuestionCount; }
    public void setHiddenQuestionCount(Long hiddenQuestionCount) { this.hiddenQuestionCount = hiddenQuestionCount; }
    public Long getTotalQuestionCount() { return totalQuestionCount; }
    public void setTotalQuestionCount(Long totalQuestionCount) { this.totalQuestionCount = totalQuestionCount; }
    public Long getPendingReportCount() { return pendingReportCount; }
    public void setPendingReportCount(Long pendingReportCount) { this.pendingReportCount = pendingReportCount; }
    public Long getTotalReportCount() { return totalReportCount; }
    public void setTotalReportCount(Long totalReportCount) { this.totalReportCount = totalReportCount; }
    public Double getAverageRating() { return averageRating; }
    public void setAverageRating(Double averageRating) { this.averageRating = averageRating; }
}
