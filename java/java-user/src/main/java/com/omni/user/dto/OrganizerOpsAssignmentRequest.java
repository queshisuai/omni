package com.omni.user.dto;

import java.time.LocalDateTime;

public class OrganizerOpsAssignmentRequest {
    private Long assignedOperatorId;
    private String riskLevel;
    private String status;
    private LocalDateTime nextFollowAt;

    public Long getAssignedOperatorId() { return assignedOperatorId; }
    public void setAssignedOperatorId(Long assignedOperatorId) { this.assignedOperatorId = assignedOperatorId; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getNextFollowAt() { return nextFollowAt; }
    public void setNextFollowAt(LocalDateTime nextFollowAt) { this.nextFollowAt = nextFollowAt; }
}
