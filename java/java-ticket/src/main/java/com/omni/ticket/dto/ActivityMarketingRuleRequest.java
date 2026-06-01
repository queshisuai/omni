package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ActivityMarketingRuleRequest {
    private Boolean enabled;
    private String couponName;
    private String discountType;
    private BigDecimal thresholdAmount;
    private BigDecimal discountAmount;
    private Integer maxCouponCount;
    private Integer perUserLimit;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

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
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
}
