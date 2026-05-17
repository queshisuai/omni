package com.omni.user.dto;

public class OrganizerApplicationReviewRequest {

    private Long reviewerId;
    private String reviewNote;

    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }

    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
}
