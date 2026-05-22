package com.omni.ticket.dto;

public class ActivityRiskResolutionRequest {
    private Long userId;
    private String resolutionNote;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
}
