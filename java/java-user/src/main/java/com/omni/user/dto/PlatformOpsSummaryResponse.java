package com.omni.user.dto;

import com.omni.common.dto.ReconciliationBatchResponse;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PlatformOpsSummaryResponse {
    private LocalDateTime generatedAt;
    private List<FunnelStep> funnelSteps = new ArrayList<>();
    private TicketSummary ticket = new TicketSummary();
    private RefundSummary refund = new RefundSummary();
    private GrabSummary grab = new GrabSummary();
    private WorkbenchSummary workbench = new WorkbenchSummary();
    private InfrastructureHealth infrastructureHealth = new InfrastructureHealth();
    private List<DownstreamError> errors = new ArrayList<>();

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public List<FunnelStep> getFunnelSteps() { return funnelSteps; }
    public void setFunnelSteps(List<FunnelStep> funnelSteps) { this.funnelSteps = funnelSteps != null ? funnelSteps : new ArrayList<>(); }
    public TicketSummary getTicket() { return ticket; }
    public void setTicket(TicketSummary ticket) { this.ticket = ticket != null ? ticket : new TicketSummary(); }
    public RefundSummary getRefund() { return refund; }
    public void setRefund(RefundSummary refund) { this.refund = refund != null ? refund : new RefundSummary(); }
    public GrabSummary getGrab() { return grab; }
    public void setGrab(GrabSummary grab) { this.grab = grab != null ? grab : new GrabSummary(); }
    public WorkbenchSummary getWorkbench() { return workbench; }
    public void setWorkbench(WorkbenchSummary workbench) { this.workbench = workbench != null ? workbench : new WorkbenchSummary(); }
    public InfrastructureHealth getInfrastructureHealth() { return infrastructureHealth; }
    public void setInfrastructureHealth(InfrastructureHealth infrastructureHealth) { this.infrastructureHealth = infrastructureHealth != null ? infrastructureHealth : new InfrastructureHealth(); }
    public List<DownstreamError> getErrors() { return errors; }
    public void setErrors(List<DownstreamError> errors) { this.errors = errors != null ? errors : new ArrayList<>(); }

    public Long funnelCount(String key) {
        return funnelSteps.stream()
                .filter(step -> key != null && key.equals(step.getKey()))
                .map(FunnelStep::getCount)
                .findFirst()
                .orElse(0L);
    }

    public static class FunnelStep {
        private String key;
        private String label;
        private Long count = 0L;

        public FunnelStep() {}

        public FunnelStep(String key, String label, Long count) {
            this.key = key;
            this.label = label;
            this.count = count;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public Long getCount() { return count; }
        public void setCount(Long count) { this.count = count; }
    }

    public static class DownstreamError {
        private String source;
        private String message;

        public DownstreamError() {}

        public DownstreamError(String source, String message) {
            this.source = source;
            this.message = message;
        }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    public static class InfrastructureHealth {
        private LocalDateTime generatedAt;
        private List<InfrastructureHealthItem> items = new ArrayList<>();

        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
        public List<InfrastructureHealthItem> getItems() { return items; }
        public void setItems(List<InfrastructureHealthItem> items) { this.items = items != null ? items : new ArrayList<>(); }
    }

    public static class InfrastructureHealthItem {
        private String key;
        private String label;
        private String status;
        private String message;

        public InfrastructureHealthItem() {}

        public InfrastructureHealthItem(String key, String label, String status, String message) {
            this.key = key;
            this.label = label;
            this.status = status;
            this.message = message;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    public static class TicketSummary {
        private Long activityCount = 0L;
        private Long ticketTypeCount = 0L;
        private Long orderCount = 0L;
        private Long paidOrderCount = 0L;
        private Long paymentTimeoutCount = 0L;
        private Long interestCount = 0L;
        private Long reminderCount = 0L;
        private Long riskCheckCount = 0L;
        private Long riskHitCount = 0L;
        private List<HotActivity> hotActivities = new ArrayList<>();

        public Long getActivityCount() { return activityCount; }
        public void setActivityCount(Long activityCount) { this.activityCount = activityCount; }
        public Long getTicketTypeCount() { return ticketTypeCount; }
        public void setTicketTypeCount(Long ticketTypeCount) { this.ticketTypeCount = ticketTypeCount; }
        public Long getOrderCount() { return orderCount; }
        public void setOrderCount(Long orderCount) { this.orderCount = orderCount; }
        public Long getPaidOrderCount() { return paidOrderCount; }
        public void setPaidOrderCount(Long paidOrderCount) { this.paidOrderCount = paidOrderCount; }
        public Long getPaymentTimeoutCount() { return paymentTimeoutCount; }
        public void setPaymentTimeoutCount(Long paymentTimeoutCount) { this.paymentTimeoutCount = paymentTimeoutCount; }
        public Long getInterestCount() { return interestCount; }
        public void setInterestCount(Long interestCount) { this.interestCount = interestCount; }
        public Long getReminderCount() { return reminderCount; }
        public void setReminderCount(Long reminderCount) { this.reminderCount = reminderCount; }
        public Long getRiskCheckCount() { return riskCheckCount; }
        public void setRiskCheckCount(Long riskCheckCount) { this.riskCheckCount = riskCheckCount; }
        public Long getRiskHitCount() { return riskHitCount; }
        public void setRiskHitCount(Long riskHitCount) { this.riskHitCount = riskHitCount; }
        public List<HotActivity> getHotActivities() { return hotActivities; }
        public void setHotActivities(List<HotActivity> hotActivities) { this.hotActivities = hotActivities != null ? hotActivities : new ArrayList<>(); }
    }

    public static class HotActivity {
        private Long activityId;
        private String activityName;
        private Long orderCount = 0L;
        private Long paidOrderCount = 0L;

        public HotActivity() {}

        public HotActivity(Long activityId, String activityName, Long orderCount, Long paidOrderCount) {
            this.activityId = activityId;
            this.activityName = activityName;
            this.orderCount = orderCount;
            this.paidOrderCount = paidOrderCount;
        }

        public Long getActivityId() { return activityId; }
        public void setActivityId(Long activityId) { this.activityId = activityId; }
        public String getActivityName() { return activityName; }
        public void setActivityName(String activityName) { this.activityName = activityName; }
        public Long getOrderCount() { return orderCount; }
        public void setOrderCount(Long orderCount) { this.orderCount = orderCount; }
        public Long getPaidOrderCount() { return paidOrderCount; }
        public void setPaidOrderCount(Long paidOrderCount) { this.paidOrderCount = paidOrderCount; }
    }

    public static class RefundSummary {
        private Long totalCount = 0L;
        private Long abnormalCount = 0L;

        public Long getTotalCount() { return totalCount; }
        public void setTotalCount(Long totalCount) { this.totalCount = totalCount; }
        public Long getAbnormalCount() { return abnormalCount; }
        public void setAbnormalCount(Long abnormalCount) { this.abnormalCount = abnormalCount; }
    }

    public static class RefundRequestItem {
        private Integer status;

        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }
    }

    public static class GrabSummary {
        private List<CountItem> failureReasons = new ArrayList<>();
        private WaitlistSummary waitlist = new WaitlistSummary();

        public List<CountItem> getFailureReasons() { return failureReasons; }
        public void setFailureReasons(List<CountItem> failureReasons) { this.failureReasons = failureReasons != null ? failureReasons : new ArrayList<>(); }
        public WaitlistSummary getWaitlist() { return waitlist; }
        public void setWaitlist(WaitlistSummary waitlist) { this.waitlist = waitlist != null ? waitlist : new WaitlistSummary(); }
    }

    public static class CountItem {
        private String reason;
        private Long count = 0L;

        public CountItem() {}

        public CountItem(String reason, Long count) {
            this.reason = reason;
            this.count = count;
        }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public Long getCount() { return count; }
        public void setCount(Long count) { this.count = count; }
    }

    public static class WaitlistSummary {
        private Long totalCount = 0L;
        private Long paidCount = 0L;
        private Double conversionRate = 0D;

        public Long getTotalCount() { return totalCount; }
        public void setTotalCount(Long totalCount) { this.totalCount = totalCount; }
        public Long getPaidCount() { return paidCount; }
        public void setPaidCount(Long paidCount) { this.paidCount = paidCount; }
        public Double getConversionRate() { return conversionRate; }
        public void setConversionRate(Double conversionRate) { this.conversionRate = conversionRate; }
    }

    public static class WorkbenchSummary {
        private Integer pendingExceptionCount = 0;
        private ReconciliationBatchResponse latestBatch;
        private OperationAuditLogResponse latestAudit;

        public Integer getPendingExceptionCount() { return pendingExceptionCount; }
        public void setPendingExceptionCount(Integer pendingExceptionCount) { this.pendingExceptionCount = pendingExceptionCount; }
        public ReconciliationBatchResponse getLatestBatch() { return latestBatch; }
        public void setLatestBatch(ReconciliationBatchResponse latestBatch) { this.latestBatch = latestBatch; }
        public OperationAuditLogResponse getLatestAudit() { return latestAudit; }
        public void setLatestAudit(OperationAuditLogResponse latestAudit) { this.latestAudit = latestAudit; }
    }
}
