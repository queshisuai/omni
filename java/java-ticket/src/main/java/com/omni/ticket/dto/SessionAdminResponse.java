package com.omni.ticket.dto;

import com.omni.ticket.entity.Session;

import java.time.LocalDateTime;

public class SessionAdminResponse {
    private Long id;
    private Long activityId;
    private String activityName;
    private Long venueId;
    private String venueName;
    private String venueCity;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer status;
    private Integer ticketTypeCount;
    private Integer totalStock;
    private Integer soldStock;
    private Integer remainStock;

    public static SessionAdminResponse from(Session session) {
        SessionAdminResponse response = new SessionAdminResponse();
        response.setId(session.getId());
        response.setActivityId(session.getActivityId());
        response.setVenueId(session.getVenueId());
        response.setStartTime(session.getStartTime());
        response.setEndTime(session.getEndTime());
        response.setStatus(session.getStatus());
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getVenueCity() { return venueCity; }
    public void setVenueCity(String venueCity) { this.venueCity = venueCity; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getTicketTypeCount() { return ticketTypeCount; }
    public void setTicketTypeCount(Integer ticketTypeCount) { this.ticketTypeCount = ticketTypeCount; }
    public Integer getTotalStock() { return totalStock; }
    public void setTotalStock(Integer totalStock) { this.totalStock = totalStock; }
    public Integer getSoldStock() { return soldStock; }
    public void setSoldStock(Integer soldStock) { this.soldStock = soldStock; }
    public Integer getRemainStock() { return remainStock; }
    public void setRemainStock(Integer remainStock) { this.remainStock = remainStock; }
}
