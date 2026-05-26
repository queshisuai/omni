package com.omni.ticket.dto;

import com.omni.ticket.entity.StationConfigVersion;

import java.time.LocalDateTime;

public class StationConfigVersionResponse {
    private Long id;
    private Long stationId;
    private Long activityId;
    private Long tourId;
    private Integer versionNo;
    private String changeType;
    private String status;
    private String city;
    private String stationName;
    private Long venueId;
    private Long venueApplicationId;
    private String venueName;
    private String venueAddress;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Boolean scheduleTba;
    private String seatTemplateSourceType;
    private Long seatTemplateSourceId;
    private String reason;
    private Long reviewerId;
    private String reviewNote;
    private LocalDateTime reviewTime;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime appliedAt;

    public StationConfigVersionResponse() {}

    public static StationConfigVersionResponse from(StationConfigVersion version) {
        if (version == null) {
            return null;
        }
        StationConfigVersionResponse response = new StationConfigVersionResponse();
        response.setId(version.getId());
        response.setStationId(version.getStationId());
        response.setActivityId(version.getActivityId());
        response.setTourId(version.getTourId());
        response.setVersionNo(version.getVersionNo());
        response.setChangeType(version.getChangeType());
        response.setStatus(version.getStatus());
        response.setCity(version.getCity());
        response.setStationName(version.getStationName());
        response.setVenueId(version.getVenueId());
        response.setVenueApplicationId(version.getVenueApplicationId());
        response.setVenueName(version.getVenueName());
        response.setVenueAddress(version.getVenueAddress());
        response.setStartTime(version.getStartTime());
        response.setEndTime(version.getEndTime());
        response.setScheduleTba(version.getScheduleTba());
        response.setSeatTemplateSourceType(version.getSeatTemplateSourceType());
        response.setSeatTemplateSourceId(version.getSeatTemplateSourceId());
        response.setReason(version.getReason());
        response.setReviewerId(version.getReviewerId());
        response.setReviewNote(version.getReviewNote());
        response.setReviewTime(version.getReviewTime());
        response.setCreatedBy(version.getCreatedBy());
        response.setCreatedAt(version.getCreatedAt());
        response.setUpdatedAt(version.getUpdatedAt());
        response.setAppliedAt(version.getAppliedAt());
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStationId() { return stationId; }
    public void setStationId(Long stationId) { this.stationId = stationId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getTourId() { return tourId; }
    public void setTourId(Long tourId) { this.tourId = tourId; }
    public Integer getVersionNo() { return versionNo; }
    public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public Long getVenueApplicationId() { return venueApplicationId; }
    public void setVenueApplicationId(Long venueApplicationId) { this.venueApplicationId = venueApplicationId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getVenueAddress() { return venueAddress; }
    public void setVenueAddress(String venueAddress) { this.venueAddress = venueAddress; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Boolean getScheduleTba() { return scheduleTba; }
    public void setScheduleTba(Boolean scheduleTba) { this.scheduleTba = scheduleTba; }
    public String getSeatTemplateSourceType() { return seatTemplateSourceType; }
    public void setSeatTemplateSourceType(String seatTemplateSourceType) { this.seatTemplateSourceType = seatTemplateSourceType; }
    public Long getSeatTemplateSourceId() { return seatTemplateSourceId; }
    public void setSeatTemplateSourceId(Long seatTemplateSourceId) { this.seatTemplateSourceId = seatTemplateSourceId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public void setReviewTime(LocalDateTime reviewTime) { this.reviewTime = reviewTime; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getAppliedAt() { return appliedAt; }
    public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }
}
