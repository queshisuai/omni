package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class ActivityMarketingOverviewResponse {
    private Long activityId;
    private String activityName;
    private ActivityMarketingRuleResponse rule;
    private List<ActivityFunnelStepResponse> funnelSteps = new ArrayList<>();

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public ActivityMarketingRuleResponse getRule() { return rule; }
    public void setRule(ActivityMarketingRuleResponse rule) { this.rule = rule; }
    public List<ActivityFunnelStepResponse> getFunnelSteps() { return funnelSteps; }
    public void setFunnelSteps(List<ActivityFunnelStepResponse> funnelSteps) { this.funnelSteps = funnelSteps; }
}
