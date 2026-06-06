package com.omni.ticket.dto;

public class CheckInOverviewResponse {
    private Long sessionId;
    private Long totalTickets;
    private Long checkedInCount;
    private Long unusedCount;
    private Long failedCount;
    private Long duplicateCount;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTotalTickets() { return totalTickets; }
    public void setTotalTickets(Long totalTickets) { this.totalTickets = totalTickets; }
    public Long getCheckedInCount() { return checkedInCount; }
    public void setCheckedInCount(Long checkedInCount) { this.checkedInCount = checkedInCount; }
    public Long getUnusedCount() { return unusedCount; }
    public void setUnusedCount(Long unusedCount) { this.unusedCount = unusedCount; }
    public Long getFailedCount() { return failedCount; }
    public void setFailedCount(Long failedCount) { this.failedCount = failedCount; }
    public Long getDuplicateCount() { return duplicateCount; }
    public void setDuplicateCount(Long duplicateCount) { this.duplicateCount = duplicateCount; }
}
