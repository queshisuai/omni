package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class TicketPurchaseContextResponse {
    private Long sessionId;
    private Long ticketTypeId;
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private String ticketTypeName;
    private String venueName;
    private LocalDateTime sessionTime;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getActivityPoster() { return activityPoster; }
    public void setActivityPoster(String activityPoster) { this.activityPoster = activityPoster; }
    public String getTicketTypeName() { return ticketTypeName; }
    public void setTicketTypeName(String ticketTypeName) { this.ticketTypeName = ticketTypeName; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public LocalDateTime getSessionTime() { return sessionTime; }
    public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }
}
