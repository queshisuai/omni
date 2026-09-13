package com.omni.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("cs_session_audit")
public class CsSessionAudit {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sessionId;
    private Long auditorUserId;
    private Integer score;
    private String comments;
    private Boolean isResolved;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Long getAuditorUserId() { return auditorUserId; }
    public void setAuditorUserId(Long auditorUserId) { this.auditorUserId = auditorUserId; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }

    public Boolean getIsResolved() { return isResolved; }
    public void setIsResolved(Boolean resolved) { isResolved = resolved; }

    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
