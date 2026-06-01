package com.omni.ticket.dto;

public class ActivityFunnelStepResponse {
    private String key;
    private String label;
    private Long count;

    public ActivityFunnelStepResponse() {
    }

    public ActivityFunnelStepResponse(String key, String label, Long count) {
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
