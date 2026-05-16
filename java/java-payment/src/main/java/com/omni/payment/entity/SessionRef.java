package com.omni.payment.entity;

import com.baomidou.mybatisplus.annotation.TableName;

@TableName("session")
public class SessionRef {

    private Long id;
    private Long activityId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
}
