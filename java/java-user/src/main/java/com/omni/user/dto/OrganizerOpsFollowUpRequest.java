package com.omni.user.dto;

import java.time.LocalDateTime;

public class OrganizerOpsFollowUpRequest {
    private String followType;
    private String content;
    private LocalDateTime nextFollowAt;

    public String getFollowType() { return followType; }
    public void setFollowType(String followType) { this.followType = followType; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public LocalDateTime getNextFollowAt() { return nextFollowAt; }
    public void setNextFollowAt(LocalDateTime nextFollowAt) { this.nextFollowAt = nextFollowAt; }
}
