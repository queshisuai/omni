package com.omni.user.dto;

public class NotificationMessageRequest {
    private Long userId;
    private Long orderId;
    private String type;
    private String content;
    private String actionHref;
    private String actionLabel;
    private String aggregateKey;

    public NotificationMessageRequest() {}

    public NotificationMessageRequest(Long userId, Long orderId, String type, String content) {
        this.userId = userId;
        this.orderId = orderId;
        this.type = type;
        this.content = content;
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getActionHref() { return actionHref; }
    public void setActionHref(String actionHref) { this.actionHref = actionHref; }
    public String getActionLabel() { return actionLabel; }
    public void setActionLabel(String actionLabel) { this.actionLabel = actionLabel; }
    public String getAggregateKey() { return aggregateKey; }
    public void setAggregateKey(String aggregateKey) { this.aggregateKey = aggregateKey; }
}
