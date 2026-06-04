package com.omni.common.dto;

import java.util.List;

public class ReconciliationBatchDetailResponse {
    private ReconciliationBatchResponse batch;
    private List<ReconciliationDetailResponse> details;
    private List<ReconciliationDifferenceResponse> differences;

    public ReconciliationBatchResponse getBatch() { return batch; }
    public void setBatch(ReconciliationBatchResponse batch) { this.batch = batch; }

    public List<ReconciliationDetailResponse> getDetails() { return details; }
    public void setDetails(List<ReconciliationDetailResponse> details) { this.details = details; }

    public List<ReconciliationDifferenceResponse> getDifferences() { return differences; }
    public void setDifferences(List<ReconciliationDifferenceResponse> differences) { this.differences = differences; }
}
