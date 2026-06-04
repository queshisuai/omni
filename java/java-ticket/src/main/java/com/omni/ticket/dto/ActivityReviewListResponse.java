package com.omni.ticket.dto;

import com.omni.ticket.entity.ActivityReview;

import java.util.ArrayList;
import java.util.List;

public class ActivityReviewListResponse {
    private ActivityReviewSummaryResponse summary = new ActivityReviewSummaryResponse();
    private List<ActivityReview> reviews = new ArrayList<>();

    public ActivityReviewSummaryResponse getSummary() { return summary; }
    public void setSummary(ActivityReviewSummaryResponse summary) { this.summary = summary; }
    public List<ActivityReview> getReviews() { return reviews; }
    public void setReviews(List<ActivityReview> reviews) { this.reviews = reviews; }
}
