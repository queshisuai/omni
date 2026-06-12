package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("activity_review_report")
public class ActivityReviewReport {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long reviewId;
    private Long activityId;
    private Long userId;
    private String reason;
    private String status;
    private Long handledBy;
    private String handleNote;
    private LocalDateTime createTime;
    private LocalDateTime handledAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReviewId() { return reviewId; }
    public void setReviewId(Long reviewId) { this.reviewId = reviewId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getHandledBy() { return handledBy; }
    public void setHandledBy(Long handledBy) { this.handledBy = handledBy; }
    public String getHandleNote() { return handleNote; }
    public void setHandleNote(String handleNote) { this.handleNote = handleNote; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getHandledAt() { return handledAt; }
    public void setHandledAt(LocalDateTime handledAt) { this.handledAt = handledAt; }
}
