package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.util.Map;

public class ActivityReviewSummaryResponse {

    private int reviewCount;
    private BigDecimal averageRating;
    private Map<Integer, Integer> ratingDistribution;

    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }

    public BigDecimal getAverageRating() { return averageRating; }
    public void setAverageRating(BigDecimal averageRating) { this.averageRating = averageRating; }

    public Map<Integer, Integer> getRatingDistribution() { return ratingDistribution; }
    public void setRatingDistribution(Map<Integer, Integer> ratingDistribution) { this.ratingDistribution = ratingDistribution; }
}
