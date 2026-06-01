package com.omni.notification.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 通知记录
 */
@TableName("notification")
public class Notification {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long orderId;
    /** 通知类型: SMS / EMAIL */
    private String type;
    private String content;
    /** 状态: 0=待发送, 1=已发送, 2=发送失败 */
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime readTime;
    private LocalDateTime deletedTime;
    private LocalDateTime updateTime;
    private String actionHref;
    private String actionLabel;
    private String aggregateKey;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getReadTime() { return readTime; }
    public void setReadTime(LocalDateTime readTime) { this.readTime = readTime; }
    public LocalDateTime getDeletedTime() { return deletedTime; }
    public void setDeletedTime(LocalDateTime deletedTime) { this.deletedTime = deletedTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public String getActionHref() { return actionHref; }
    public void setActionHref(String actionHref) { this.actionHref = actionHref; }
    public String getActionLabel() { return actionLabel; }
    public void setActionLabel(String actionLabel) { this.actionLabel = actionLabel; }
    public String getAggregateKey() { return aggregateKey; }
    public void setAggregateKey(String aggregateKey) { this.aggregateKey = aggregateKey; }
}
