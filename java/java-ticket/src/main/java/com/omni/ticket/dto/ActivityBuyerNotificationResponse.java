package com.omni.ticket.dto;

public class ActivityBuyerNotificationResponse {

    private Long activityId;
    private String activityName;
    private Integer paidOrderCount;
    private Integer notifiedUserCount;
    private Integer notificationCount;
    private Integer skippedOrderCount;

    public Long getActivityId() {
        return activityId;
    }

    public void setActivityId(Long activityId) {
        this.activityId = activityId;
    }

    public String getActivityName() {
        return activityName;
    }

    public void setActivityName(String activityName) {
        this.activityName = activityName;
    }

    public Integer getPaidOrderCount() {
        return paidOrderCount;
    }

    public void setPaidOrderCount(Integer paidOrderCount) {
        this.paidOrderCount = paidOrderCount;
    }

    public Integer getNotifiedUserCount() {
        return notifiedUserCount;
    }

    public void setNotifiedUserCount(Integer notifiedUserCount) {
        this.notifiedUserCount = notifiedUserCount;
    }

    public Integer getNotificationCount() {
        return notificationCount;
    }

    public void setNotificationCount(Integer notificationCount) {
        this.notificationCount = notificationCount;
    }

    public Integer getSkippedOrderCount() {
        return skippedOrderCount;
    }

    public void setSkippedOrderCount(Integer skippedOrderCount) {
        this.skippedOrderCount = skippedOrderCount;
    }
}
