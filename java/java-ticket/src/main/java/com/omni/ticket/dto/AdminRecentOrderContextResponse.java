package com.omni.ticket.dto;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

public class AdminRecentOrderContextResponse {
    private Long userId;
    private List<OrderSummary> orders = Collections.emptyList();

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public List<OrderSummary> getOrders() {
        return orders;
    }

    public void setOrders(List<OrderSummary> orders) {
        this.orders = orders == null ? Collections.emptyList() : orders;
    }

    public static class OrderSummary {
        private Long orderId;
        private String orderNo;
        private String activityName;
        private String venueName;
        private LocalDateTime sessionTime;
        private String ticketName;
        private String seatLabels;
        private Integer status;
        private String fulfillmentStatus;

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }
        public String getOrderNo() { return orderNo; }
        public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
        public String getActivityName() { return activityName; }
        public void setActivityName(String activityName) { this.activityName = activityName; }
        public String getVenueName() { return venueName; }
        public void setVenueName(String venueName) { this.venueName = venueName; }
        public LocalDateTime getSessionTime() { return sessionTime; }
        public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }
        public String getTicketName() { return ticketName; }
        public void setTicketName(String ticketName) { this.ticketName = ticketName; }
        public String getSeatLabels() { return seatLabels; }
        public void setSeatLabels(String seatLabels) { this.seatLabels = seatLabels; }
        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }
        public String getFulfillmentStatus() { return fulfillmentStatus; }
        public void setFulfillmentStatus(String fulfillmentStatus) { this.fulfillmentStatus = fulfillmentStatus; }
    }
}
