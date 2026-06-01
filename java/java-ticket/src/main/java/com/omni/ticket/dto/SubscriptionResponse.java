package com.omni.ticket.dto;

import java.time.LocalDateTime;
import java.util.List;

public class SubscriptionResponse {
    private Long id;
    private Long userId;
    private String targetType;
    private Long targetId;
    private String targetValue;
    private String targetName;
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private Long artistId;
    private String artistName;
    private String city;
    private Long sessionId;
    private LocalDateTime startTime;
    private String venueName;
    private String saleStatusText;
    private List<String> readyChecklist;
    private Integer remindBeforeMinutes;
    private Integer status;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetValue() { return targetValue; }
    public void setTargetValue(String targetValue) { this.targetValue = targetValue; }
    public String getTargetName() { return targetName; }
    public void setTargetName(String targetName) { this.targetName = targetName; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getActivityPoster() { return activityPoster; }
    public void setActivityPoster(String activityPoster) { this.activityPoster = activityPoster; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getArtistName() { return artistName; }
    public void setArtistName(String artistName) { this.artistName = artistName; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getSaleStatusText() { return saleStatusText; }
    public void setSaleStatusText(String saleStatusText) { this.saleStatusText = saleStatusText; }
    public List<String> getReadyChecklist() { return readyChecklist; }
    public void setReadyChecklist(List<String> readyChecklist) { this.readyChecklist = readyChecklist; }
    public Integer getRemindBeforeMinutes() { return remindBeforeMinutes; }
    public void setRemindBeforeMinutes(Integer remindBeforeMinutes) { this.remindBeforeMinutes = remindBeforeMinutes; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
