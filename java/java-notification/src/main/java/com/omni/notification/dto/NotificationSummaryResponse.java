package com.omni.notification.dto;

import java.util.Map;

public class NotificationSummaryResponse {
    private int unreadCount;
    private int visibleCount;
    private int readCount;
    private Map<String, Integer> typeCounts;

    public NotificationSummaryResponse() {}

    public NotificationSummaryResponse(int unreadCount, int visibleCount, int readCount, Map<String, Integer> typeCounts) {
        this.unreadCount = unreadCount;
        this.visibleCount = visibleCount;
        this.readCount = readCount;
        this.typeCounts = typeCounts;
    }

    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }
    public int getVisibleCount() { return visibleCount; }
    public void setVisibleCount(int visibleCount) { this.visibleCount = visibleCount; }
    public int getReadCount() { return readCount; }
    public void setReadCount(int readCount) { this.readCount = readCount; }
    public Map<String, Integer> getTypeCounts() { return typeCounts; }
    public void setTypeCounts(Map<String, Integer> typeCounts) { this.typeCounts = typeCounts; }
}
