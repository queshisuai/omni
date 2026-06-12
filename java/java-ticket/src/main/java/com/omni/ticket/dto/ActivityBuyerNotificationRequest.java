package com.omni.ticket.dto;

public class ActivityBuyerNotificationRequest {

    private Long userId;
    private Boolean confirmNotify;
    private String content;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Boolean getConfirmNotify() {
        return confirmNotify;
    }

    public void setConfirmNotify(Boolean confirmNotify) {
        this.confirmNotify = confirmNotify;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
