package com.omni.user.dto;

import java.time.LocalDateTime;

public class OrganizerOpsAssignmentResponse {
    private Long organizerUserId;
    private Long assignedOperatorId;
    private String riskLevel;
    private String status;
    private LocalDateTime nextFollowAt;
    private LocalDateTime lastFollowAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getOrganizerUserId() { return organizerUserId; }
    public void setOrganizerUserId(Long organizerUserId) { this.organizerUserId = organizerUserId; }

    public Long getAssignedOperatorId() { return assignedOperatorId; }
    public void setAssignedOperatorId(Long assignedOperatorId) { this.assignedOperatorId = assignedOperatorId; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getNextFollowAt() { return nextFollowAt; }
    public void setNextFollowAt(LocalDateTime nextFollowAt) { this.nextFollowAt = nextFollowAt; }

    public LocalDateTime getLastFollowAt() { return lastFollowAt; }
    public void setLastFollowAt(LocalDateTime lastFollowAt) { this.lastFollowAt = lastFollowAt; }

    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }

    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
