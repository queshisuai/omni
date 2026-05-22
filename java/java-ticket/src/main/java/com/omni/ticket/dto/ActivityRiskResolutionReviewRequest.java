package com.omni.ticket.dto;

public class ActivityRiskResolutionReviewRequest {
    private Long userId;
    private String action;
    private String reviewNote;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
}
