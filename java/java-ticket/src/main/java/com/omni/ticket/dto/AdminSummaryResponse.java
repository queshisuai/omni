package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class AdminSummaryResponse {

    private Long activityCount;
    private Long ticketTypeCount;
    private Long paidOrderCount;
    private Long orderCount = 0L;
    private Long paymentTimeoutCount = 0L;
    private Long refundRequestCount = 0L;
    private Long refundAbnormalCount = 0L;
    private Long riskCheckCount = 0L;
    private Long riskHitCount = 0L;
    private List<HotActivityResponse> hotActivities = new ArrayList<>();

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

    public Long getOrderCount() {
        return orderCount;
    }

    public void setOrderCount(Long orderCount) {
        this.orderCount = orderCount;
    }

    public Long getPaymentTimeoutCount() {
        return paymentTimeoutCount;
    }

    public void setPaymentTimeoutCount(Long paymentTimeoutCount) {
        this.paymentTimeoutCount = paymentTimeoutCount;
    }

    public Long getRefundRequestCount() {
        return refundRequestCount;
    }

    public void setRefundRequestCount(Long refundRequestCount) {
        this.refundRequestCount = refundRequestCount;
    }

    public Long getRefundAbnormalCount() {
        return refundAbnormalCount;
    }

    public void setRefundAbnormalCount(Long refundAbnormalCount) {
        this.refundAbnormalCount = refundAbnormalCount;
    }

    public Long getRiskCheckCount() {
        return riskCheckCount;
    }

    public void setRiskCheckCount(Long riskCheckCount) {
        this.riskCheckCount = riskCheckCount;
    }

    public Long getRiskHitCount() {
        return riskHitCount;
    }

    public void setRiskHitCount(Long riskHitCount) {
        this.riskHitCount = riskHitCount;
    }

    public List<HotActivityResponse> getHotActivities() {
        return hotActivities;
    }

    public void setHotActivities(List<HotActivityResponse> hotActivities) {
        this.hotActivities = hotActivities;
    }

    public static class HotActivityResponse {
        private Long activityId;
        private String activityName;
        private Long orderCount;
        private Long paidOrderCount;

        public HotActivityResponse() {
        }

        public HotActivityResponse(Long activityId, String activityName, Long orderCount, Long paidOrderCount) {
            this.activityId = activityId;
            this.activityName = activityName;
            this.orderCount = orderCount;
            this.paidOrderCount = paidOrderCount;
        }

        public Long getActivityId() {
            return activityId;
        }

        public void setActivityId(Long activityId) {
            this.activityId = activityId;
        }

        public String getActivityName() {
            return activityName;
        }

        public void setActivityName(String activityName) {
            this.activityName = activityName;
        }

        public Long getOrderCount() {
            return orderCount;
        }

        public void setOrderCount(Long orderCount) {
            this.orderCount = orderCount;
        }

        public Long getPaidOrderCount() {
            return paidOrderCount;
        }

        public void setPaidOrderCount(Long paidOrderCount) {
            this.paidOrderCount = paidOrderCount;
        }
    }
}
