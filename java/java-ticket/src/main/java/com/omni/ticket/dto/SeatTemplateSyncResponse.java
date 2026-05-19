package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class SeatTemplateSyncResponse {
    private Integer syncedSessionCount;
    private Integer skippedSessionCount;
    private List<Long> skippedSessionIds;

    public SeatTemplateSyncResponse() {
        this.syncedSessionCount = 0;
        this.skippedSessionCount = 0;
        this.skippedSessionIds = new ArrayList<>();
    }

    public Integer getSyncedSessionCount() { return syncedSessionCount; }
    public void setSyncedSessionCount(Integer syncedSessionCount) { this.syncedSessionCount = syncedSessionCount; }
    public Integer getSkippedSessionCount() { return skippedSessionCount; }
    public void setSkippedSessionCount(Integer skippedSessionCount) { this.skippedSessionCount = skippedSessionCount; }
    public List<Long> getSkippedSessionIds() { return skippedSessionIds; }
    public void setSkippedSessionIds(List<Long> skippedSessionIds) { this.skippedSessionIds = skippedSessionIds; }
}
