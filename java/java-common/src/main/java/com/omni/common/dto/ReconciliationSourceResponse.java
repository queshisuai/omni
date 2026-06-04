package com.omni.common.dto;

import java.util.Collections;
import java.util.List;

public class ReconciliationSourceResponse {
    private String summaryJson;
    private List<ReconciliationDetailResponse> details = Collections.emptyList();
    private List<ReconciliationDifferenceResponse> differences = Collections.emptyList();

    public String getSummaryJson() { return summaryJson; }
    public void setSummaryJson(String summaryJson) { this.summaryJson = summaryJson; }

    public List<ReconciliationDetailResponse> getDetails() { return details; }
    public void setDetails(List<ReconciliationDetailResponse> details) { this.details = details; }

    public List<ReconciliationDifferenceResponse> getDifferences() { return differences; }
    public void setDifferences(List<ReconciliationDifferenceResponse> differences) { this.differences = differences; }
}
