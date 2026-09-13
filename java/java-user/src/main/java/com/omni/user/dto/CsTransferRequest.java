package com.omni.user.dto;

public class CsTransferRequest {
    private Long targetGroupId;
    private Long targetAgentId;
    private String transferNote;

    public Long getTargetGroupId() { return targetGroupId; }
    public void setTargetGroupId(Long targetGroupId) { this.targetGroupId = targetGroupId; }
    public Long getTargetAgentId() { return targetAgentId; }
    public void setTargetAgentId(Long targetAgentId) { this.targetAgentId = targetAgentId; }
    public String getTransferNote() { return transferNote; }
    public void setTransferNote(String transferNote) { this.transferNote = transferNote; }
}
