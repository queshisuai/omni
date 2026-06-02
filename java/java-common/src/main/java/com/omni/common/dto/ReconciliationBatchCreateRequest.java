package com.omni.common.dto;

import java.time.LocalDate;

public class ReconciliationBatchCreateRequest {
    private LocalDate bizDate;

    public LocalDate getBizDate() { return bizDate; }
    public void setBizDate(LocalDate bizDate) { this.bizDate = bizDate; }
}
