package com.omni.ticket.dto;

public class DeleteActivityResponse {
    private Long activityId;
    private String publishStatus;
    private Integer status;
    private Boolean deleted;
    private Boolean refundBlocked;
    private String message;

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getPublishStatus() { return publishStatus; }
    public void setPublishStatus(String publishStatus) { this.publishStatus = publishStatus; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Boolean getDeleted() { return deleted; }
    public void setDeleted(Boolean deleted) { this.deleted = deleted; }
    public Boolean getRefundBlocked() { return refundBlocked; }
    public void setRefundBlocked(Boolean refundBlocked) { this.refundBlocked = refundBlocked; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
