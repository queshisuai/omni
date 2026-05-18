package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class RefundImpactResponse {

    private Long activityId;
    private String activityName;
    private Integer deactivatedActivityCount;
    private Integer deactivatedSessionCount;
    private Integer deactivatedTicketTypeCount;
    private Integer paidOrderCount;
    private Integer refundSuccessCount;
    private Integer refundFailedCount;
    private Integer refundUnknownCount;
    private Integer refundCompensationRequiredCount;
    private List<DirectRefundResponse> failures = new ArrayList<>();

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public Integer getDeactivatedActivityCount() { return deactivatedActivityCount; }
    public void setDeactivatedActivityCount(Integer deactivatedActivityCount) { this.deactivatedActivityCount = deactivatedActivityCount; }
    public Integer getDeactivatedSessionCount() { return deactivatedSessionCount; }
    public void setDeactivatedSessionCount(Integer deactivatedSessionCount) { this.deactivatedSessionCount = deactivatedSessionCount; }
    public Integer getDeactivatedTicketTypeCount() { return deactivatedTicketTypeCount; }
    public void setDeactivatedTicketTypeCount(Integer deactivatedTicketTypeCount) { this.deactivatedTicketTypeCount = deactivatedTicketTypeCount; }
    public Integer getPaidOrderCount() { return paidOrderCount; }
    public void setPaidOrderCount(Integer paidOrderCount) { this.paidOrderCount = paidOrderCount; }
    public Integer getRefundSuccessCount() { return refundSuccessCount; }
    public void setRefundSuccessCount(Integer refundSuccessCount) { this.refundSuccessCount = refundSuccessCount; }
    public Integer getRefundFailedCount() { return refundFailedCount; }
    public void setRefundFailedCount(Integer refundFailedCount) { this.refundFailedCount = refundFailedCount; }
    public Integer getRefundUnknownCount() { return refundUnknownCount; }
    public void setRefundUnknownCount(Integer refundUnknownCount) { this.refundUnknownCount = refundUnknownCount; }
    public Integer getRefundCompensationRequiredCount() { return refundCompensationRequiredCount; }
    public void setRefundCompensationRequiredCount(Integer refundCompensationRequiredCount) { this.refundCompensationRequiredCount = refundCompensationRequiredCount; }
    public List<DirectRefundResponse> getFailures() { return failures; }
    public void setFailures(List<DirectRefundResponse> failures) { this.failures = failures; }
}
