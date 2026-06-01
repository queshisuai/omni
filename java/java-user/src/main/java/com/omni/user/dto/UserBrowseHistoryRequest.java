package com.omni.user.dto;

public class UserBrowseHistoryRequest {
    private Long activityId;
    private String activityName;
    private String poster;
    private String category;
    private String artist;
    private String city;

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getPoster() { return poster; }
    public void setPoster(String poster) { this.poster = poster; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getArtist() { return artist; }
    public void setArtist(String artist) { this.artist = artist; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
}
