package com.omni.user.dto;

import java.time.LocalDateTime;

public class OrganizerOpsFollowUpResponse {
    private Long id;
    private Long organizerUserId;
    private Long operatorId;
    private String followType;
    private String content;
    private LocalDateTime nextFollowAt;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizerUserId() { return organizerUserId; }
    public void setOrganizerUserId(Long organizerUserId) { this.organizerUserId = organizerUserId; }

    public Long getOperatorId() { return operatorId; }
    public void setOperatorId(Long operatorId) { this.operatorId = operatorId; }

    public String getFollowType() { return followType; }
    public void setFollowType(String followType) { this.followType = followType; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public LocalDateTime getNextFollowAt() { return nextFollowAt; }
    public void setNextFollowAt(LocalDateTime nextFollowAt) { this.nextFollowAt = nextFollowAt; }

    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
