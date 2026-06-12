package com.omni.common.mq.message;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 统一通知事件 MQ 载体。
 */
public class NotificationEventMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    public static final String CHANNEL_IN_APP = "IN_APP";
    public static final String CHANNEL_SMS = "SMS";
    public static final String PRIORITY_NORMAL = "NORMAL";

    private String eventId;
    private String eventType;
    private String aggregateKey;
    private Long userId;
    private Long orderId;
    private Long activityId;
    private String templateCode;
    private List<String> channels;
    private String priority;
    private String content;
    private String actionHref;
    private String actionLabel;
    private Map<String, Object> payload;
    private LocalDateTime occurredAt;

    public List<String> effectiveChannels() {
        if (channels == null || channels.isEmpty()) {
            return Collections.singletonList(CHANNEL_IN_APP);
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String channel : channels) {
            if (channel == null) {
                continue;
            }
            String value = channel.trim();
            if (!value.isEmpty()) {
                normalized.add(value.toUpperCase(Locale.ROOT));
            }
        }
        if (normalized.isEmpty()) {
            return Collections.singletonList(CHANNEL_IN_APP);
        }
        return Collections.unmodifiableList(new ArrayList<>(normalized));
    }

    public String effectivePriority() {
        if (priority == null || priority.trim().isEmpty()) {
            return PRIORITY_NORMAL;
        }
        return priority.trim().toUpperCase(Locale.ROOT);
    }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getAggregateKey() { return aggregateKey; }
    public void setAggregateKey(String aggregateKey) { this.aggregateKey = aggregateKey; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getTemplateCode() { return templateCode; }
    public void setTemplateCode(String templateCode) { this.templateCode = templateCode; }
    public List<String> getChannels() { return channels; }
    public void setChannels(List<String> channels) { this.channels = channels; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getActionHref() { return actionHref; }
    public void setActionHref(String actionHref) { this.actionHref = actionHref; }
    public String getActionLabel() { return actionLabel; }
    public void setActionLabel(String actionLabel) { this.actionLabel = actionLabel; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
}
