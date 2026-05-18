package com.omni.ticket.dto;

public class VenueApplicationReviewRequest {
    private Long userId;
    private String action;
    private String mode;
    private Long venueId;
    private String reviewNote;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
}
