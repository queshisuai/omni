package com.omni.user.dto;

import java.time.LocalDateTime;

public class CsSessionResponse {
    private Long id;
    private Long userId;
    private String userNickname;
    private String userPhoneMask;
    private String subject;
    private String status;
    private String sourceType;
    private Long assignedAgentId;
    private String assignedAgentName;
    private Long skillGroupId;
    private String skillGroupName;
    private String lastMessage;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime closedAt;
    private Boolean slaTimeoutFlag;
    private Boolean slaOverdue;
    private Long userWaitingSeconds;
    private Boolean needAudit;
    private Integer latestAuditScore;
    private Boolean escalatedToAdmin;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserNickname() { return userNickname; }
    public void setUserNickname(String userNickname) { this.userNickname = userNickname; }
    public String getUserPhoneMask() { return userPhoneMask; }
    public void setUserPhoneMask(String userPhoneMask) { this.userPhoneMask = userPhoneMask; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Long getAssignedAgentId() { return assignedAgentId; }
    public void setAssignedAgentId(Long assignedAgentId) { this.assignedAgentId = assignedAgentId; }
    public String getAssignedAgentName() { return assignedAgentName; }
    public void setAssignedAgentName(String assignedAgentName) { this.assignedAgentName = assignedAgentName; }
    public Long getSkillGroupId() { return skillGroupId; }
    public void setSkillGroupId(Long skillGroupId) { this.skillGroupId = skillGroupId; }
    public String getSkillGroupName() { return skillGroupName; }
    public void setSkillGroupName(String skillGroupName) { this.skillGroupName = skillGroupName; }
    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public Boolean getSlaTimeoutFlag() { return slaTimeoutFlag; }
    public void setSlaTimeoutFlag(Boolean slaTimeoutFlag) { this.slaTimeoutFlag = slaTimeoutFlag; }
    public Boolean getSlaOverdue() { return slaOverdue; }
    public void setSlaOverdue(Boolean slaOverdue) { this.slaOverdue = slaOverdue; }
    public Long getUserWaitingSeconds() { return userWaitingSeconds; }
    public void setUserWaitingSeconds(Long userWaitingSeconds) { this.userWaitingSeconds = userWaitingSeconds; }
    public Boolean getNeedAudit() { return needAudit; }
    public void setNeedAudit(Boolean needAudit) { this.needAudit = needAudit; }
    public Integer getLatestAuditScore() { return latestAuditScore; }
    public void setLatestAuditScore(Integer latestAuditScore) { this.latestAuditScore = latestAuditScore; }
    public Boolean getEscalatedToAdmin() { return escalatedToAdmin; }
    public void setEscalatedToAdmin(Boolean escalatedToAdmin) { this.escalatedToAdmin = escalatedToAdmin; }
}
