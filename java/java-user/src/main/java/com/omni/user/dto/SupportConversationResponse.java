package com.omni.user.dto;

import java.time.LocalDateTime;

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
}
