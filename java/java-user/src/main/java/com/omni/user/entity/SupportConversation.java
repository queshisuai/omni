package com.omni.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("support_conversation")
public class SupportConversation {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
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
    private String closeRequestReason;
    private Long closeRequestedBy;
    private LocalDateTime closeRequestedAt;
    private Boolean escalatedToAdmin;
    private String escalationReason;
    private LocalDateTime escalatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

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
}
