package com.omni.ticket.dto;

import java.util.LinkedHashMap;
import java.util.Map;

public class ActivityReviewSummaryResponse {
    private int reviewCount;
    private double averageRating;
    private Map<String, Integer> ratingDistribution = new LinkedHashMap<>();

    public ActivityReviewSummaryResponse() {
        for (int rating = 1; rating <= 5; rating++) {
            ratingDistribution.put(String.valueOf(rating), 0);
        }
    }

    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }
    public double getAverageRating() { return averageRating; }
    public void setAverageRating(double averageRating) { this.averageRating = averageRating; }
    public Map<String, Integer> getRatingDistribution() { return ratingDistribution; }
    public void setRatingDistribution(Map<String, Integer> ratingDistribution) { this.ratingDistribution = ratingDistribution; }
}
