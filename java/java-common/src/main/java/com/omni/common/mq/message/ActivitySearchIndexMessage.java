package com.omni.common.mq.message;

import java.io.Serializable;
import java.time.LocalDateTime;

public class ActivitySearchIndexMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    public static final String EVENT_TYPE_UPSERT = "UPSERT";
    public static final String EVENT_TYPE_DELETE = "DELETE";

    private String eventId;
    private Long activityId;
    private String eventType;
    private LocalDateTime occurredAt;

    public ActivitySearchIndexMessage() {}

    public ActivitySearchIndexMessage(String eventId, Long activityId, String eventType, LocalDateTime occurredAt) {
        this.eventId = eventId;
        this.activityId = activityId;
        this.eventType = eventType;
        this.occurredAt = occurredAt;
    }

    public static ActivitySearchIndexMessage upsert(Long activityId) {
        return of(activityId, EVENT_TYPE_UPSERT);
    }

    public static ActivitySearchIndexMessage delete(Long activityId) {
        return of(activityId, EVENT_TYPE_DELETE);
    }

    public static ActivitySearchIndexMessage of(Long activityId, String eventType) {
        LocalDateTime occurredAt = LocalDateTime.now();
        return new ActivitySearchIndexMessage(eventId(activityId, eventType, occurredAt), activityId, eventType, occurredAt);
    }

    private static String eventId(Long activityId, String eventType, LocalDateTime occurredAt) {
        return "activity-search:" + activityId + ":" + eventType + ":" + occurredAt;
    }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
}
