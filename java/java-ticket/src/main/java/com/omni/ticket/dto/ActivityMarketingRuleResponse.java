package com.omni.ticket.dto;

import com.omni.ticket.entity.ActivityMarketingRule;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ActivityMarketingRuleResponse {
    private Boolean enabled;
    private String couponName;
    private String discountType;
    private BigDecimal thresholdAmount;
    private BigDecimal discountAmount;
    private Integer maxCouponCount;
    private Integer perUserLimit;
    private Integer claimedCount;
    private Integer usedCount;
    private Integer status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    public static ActivityMarketingRuleResponse from(ActivityMarketingRule rule) {
        ActivityMarketingRuleResponse response = new ActivityMarketingRuleResponse();
        if (rule == null) {
            response.setEnabled(false);
            response.setDiscountType("NONE");
            response.setStatus(0);
            response.setClaimedCount(0);
            response.setUsedCount(0);
            return response;
        }
        response.setEnabled(Boolean.TRUE.equals(rule.getEnabled()));
        response.setCouponName(rule.getCouponName());
        response.setDiscountType(rule.getDiscountType());
        response.setThresholdAmount(rule.getThresholdAmount());
        response.setDiscountAmount(rule.getDiscountAmount());
        response.setMaxCouponCount(rule.getMaxCouponCount());
        response.setPerUserLimit(rule.getPerUserLimit());
        response.setClaimedCount(rule.getClaimedCount() == null ? 0 : rule.getClaimedCount());
        response.setUsedCount(rule.getUsedCount() == null ? 0 : rule.getUsedCount());
        response.setStatus(rule.getStatus() == null ? 0 : rule.getStatus());
        response.setStartTime(rule.getStartTime());
        response.setEndTime(rule.getEndTime());
        return response;
    }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public String getCouponName() { return couponName; }
    public void setCouponName(String couponName) { this.couponName = couponName; }
    public String getDiscountType() { return discountType; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }
    public BigDecimal getThresholdAmount() { return thresholdAmount; }
    public void setThresholdAmount(BigDecimal thresholdAmount) { this.thresholdAmount = thresholdAmount; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public Integer getMaxCouponCount() { return maxCouponCount; }
    public void setMaxCouponCount(Integer maxCouponCount) { this.maxCouponCount = maxCouponCount; }
    public Integer getPerUserLimit() { return perUserLimit; }
    public void setPerUserLimit(Integer perUserLimit) { this.perUserLimit = perUserLimit; }
    public Integer getClaimedCount() { return claimedCount; }
    public void setClaimedCount(Integer claimedCount) { this.claimedCount = claimedCount; }
    public Integer getUsedCount() { return usedCount; }
    public void setUsedCount(Integer usedCount) { this.usedCount = usedCount; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
}
