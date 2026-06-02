package com.omni.user.dto;

import java.time.LocalDateTime;
import java.util.List;

public class SupportConversationResponse {

    private Long id;
    private Long userId;
    private String userNickname;
    private String userPhoneMask;
    private String subject;
    private String status;
    private String sourceType;
    private Long assignedAgentId;
    private String lastMessage;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime closedAt;
    private LocalDateTime firstResponseDueAt;
    private LocalDateTime firstAgentRepliedAt;
    private LocalDateTime lastUserMessageAt;
    private LocalDateTime lastAgentMessageAt;
    private Long userWaitingSeconds;
    private Boolean slaOverdue;
    private String closeRequestReason;
    private Long closeRequestedBy;
    private LocalDateTime closeRequestedAt;
    private Boolean escalatedToAdmin;
    private String escalationReason;
    private LocalDateTime escalatedAt;
    private List<String> tags;

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

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }

    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }

    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }

    public LocalDateTime getFirstResponseDueAt() { return firstResponseDueAt; }
    public void setFirstResponseDueAt(LocalDateTime firstResponseDueAt) { this.firstResponseDueAt = firstResponseDueAt; }

    public LocalDateTime getFirstAgentRepliedAt() { return firstAgentRepliedAt; }
    public void setFirstAgentRepliedAt(LocalDateTime firstAgentRepliedAt) { this.firstAgentRepliedAt = firstAgentRepliedAt; }

    public LocalDateTime getLastUserMessageAt() { return lastUserMessageAt; }
    public void setLastUserMessageAt(LocalDateTime lastUserMessageAt) { this.lastUserMessageAt = lastUserMessageAt; }

    public LocalDateTime getLastAgentMessageAt() { return lastAgentMessageAt; }
    public void setLastAgentMessageAt(LocalDateTime lastAgentMessageAt) { this.lastAgentMessageAt = lastAgentMessageAt; }

    public Long getUserWaitingSeconds() { return userWaitingSeconds; }
    public void setUserWaitingSeconds(Long userWaitingSeconds) { this.userWaitingSeconds = userWaitingSeconds; }

    public Boolean getSlaOverdue() { return slaOverdue; }
    public void setSlaOverdue(Boolean slaOverdue) { this.slaOverdue = slaOverdue; }

    public String getCloseRequestReason() { return closeRequestReason; }
    public void setCloseRequestReason(String closeRequestReason) { this.closeRequestReason = closeRequestReason; }

    public Long getCloseRequestedBy() { return closeRequestedBy; }
    public void setCloseRequestedBy(Long closeRequestedBy) { this.closeRequestedBy = closeRequestedBy; }

    public LocalDateTime getCloseRequestedAt() { return closeRequestedAt; }
    public void setCloseRequestedAt(LocalDateTime closeRequestedAt) { this.closeRequestedAt = closeRequestedAt; }

    public Boolean getEscalatedToAdmin() { return escalatedToAdmin; }
    public void setEscalatedToAdmin(Boolean escalatedToAdmin) { this.escalatedToAdmin = escalatedToAdmin; }

    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }

    public LocalDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(LocalDateTime escalatedAt) { this.escalatedAt = escalatedAt; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
