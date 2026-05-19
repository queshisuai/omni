package com.omni.ticket.dto;

public class AdminSummaryResponse {

    private Long activityCount;
    private Long ticketTypeCount;
    private Long paidOrderCount;

    public AdminSummaryResponse() {
    }

    public AdminSummaryResponse(Long activityCount, Long ticketTypeCount, Long paidOrderCount) {
        this.activityCount = activityCount;
        this.ticketTypeCount = ticketTypeCount;
        this.paidOrderCount = paidOrderCount;
    }

    public Long getActivityCount() {
        return activityCount;
    }

    public void setActivityCount(Long activityCount) {
        this.activityCount = activityCount;
    }

    public Long getTicketTypeCount() {
        return ticketTypeCount;
    }

    public void setTicketTypeCount(Long ticketTypeCount) {
        this.ticketTypeCount = ticketTypeCount;
    }

    public Long getPaidOrderCount() {
        return paidOrderCount;
    }

    public void setPaidOrderCount(Long paidOrderCount) {
        this.paidOrderCount = paidOrderCount;
    }
}
