package com.omni.ticket.dto;

import java.util.List;

public class ActivityReviewListResponse {

    private ActivityReviewSummaryResponse summary;
    private List<ActivityReviewResponse> reviews;

    public ActivityReviewSummaryResponse getSummary() { return summary; }
    public void setSummary(ActivityReviewSummaryResponse summary) { this.summary = summary; }

    public List<ActivityReviewResponse> getReviews() { return reviews; }
    public void setReviews(List<ActivityReviewResponse> reviews) { this.reviews = reviews; }
}
