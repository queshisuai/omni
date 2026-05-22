package com.omni.ticket.dto;

public class ArtistRiskRequest {
    private Long userId;
    private String riskStatus;
    private String reason;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getRiskStatus() { return riskStatus; }
    public void setRiskStatus(String riskStatus) { this.riskStatus = riskStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
