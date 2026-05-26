package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class StationConfigVersionRequest {
    private Long userId;
    private String changeType;
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

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
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
}
