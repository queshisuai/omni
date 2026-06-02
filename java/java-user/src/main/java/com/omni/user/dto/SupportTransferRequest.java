package com.omni.user.dto;

public class SupportTransferRequest {
    private Long targetAgentId;
    private String reason;

    public Long getTargetAgentId() { return targetAgentId; }
    public void setTargetAgentId(Long targetAgentId) { this.targetAgentId = targetAgentId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
