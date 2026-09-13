package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class StationConfigReviewDiffResponse {
    private Snapshot current;
    private Snapshot target;
    private StationConfigVersionResponse version;
    private Boolean highRisk;
    private String warning;

    public Snapshot getCurrent() { return current; }
    public void setCurrent(Snapshot current) { this.current = current; }
    public Snapshot getTarget() { return target; }
    public void setTarget(Snapshot target) { this.target = target; }
    public StationConfigVersionResponse getVersion() { return version; }
    public void setVersion(StationConfigVersionResponse version) { this.version = version; }
    public Boolean getHighRisk() { return highRisk; }
    public void setHighRisk(Boolean highRisk) { this.highRisk = highRisk; }
    public String getWarning() { return warning; }
    public void setWarning(String warning) { this.warning = warning; }

    public static class Snapshot {
        private Long stationId;
        private Long activityId;
        private Long tourId;
        private String city;
        private String stationName;
        private Long venueId;
        private String venueName;
        private String venueAddress;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private Boolean scheduleTba;
        private String seatTemplateSourceType;
        private Long seatTemplateSourceId;
        private Long totalStock;

        public Long getStationId() { return stationId; }
        public void setStationId(Long stationId) { this.stationId = stationId; }
        public Long getActivityId() { return activityId; }
        public void setActivityId(Long activityId) { this.activityId = activityId; }
        public Long getTourId() { return tourId; }
        public void setTourId(Long tourId) { this.tourId = tourId; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        public String getStationName() { return stationName; }
        public void setStationName(String stationName) { this.stationName = stationName; }
        public Long getVenueId() { return venueId; }
        public void setVenueId(Long venueId) { this.venueId = venueId; }
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
        public Long getTotalStock() { return totalStock; }
        public void setTotalStock(Long totalStock) { this.totalStock = totalStock; }
    }
}
