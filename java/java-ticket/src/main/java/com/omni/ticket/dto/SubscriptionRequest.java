package com.omni.ticket.dto;

public class SubscriptionRequest {
    private String targetType;
    private Long targetId;
    private String targetValue;
    private Long activityId;
    private Long artistId;
    private String city;
    private Integer remindBeforeMinutes;

    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetValue() { return targetValue; }
    public void setTargetValue(String targetValue) { this.targetValue = targetValue; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public Integer getRemindBeforeMinutes() { return remindBeforeMinutes; }
    public void setRemindBeforeMinutes(Integer remindBeforeMinutes) { this.remindBeforeMinutes = remindBeforeMinutes; }
}
