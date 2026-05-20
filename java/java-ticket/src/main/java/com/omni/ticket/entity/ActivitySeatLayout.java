package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("activity_seat_layout")
public class ActivitySeatLayout {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long activityId;
    private Long sourceVenueLayoutId;
    private String name;
    private String templateType;
    private String stageTitle;
    private Integer stageX;
    private Integer stageY;
    private Integer canvasWidth;
    private Integer canvasHeight;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getSourceVenueLayoutId() { return sourceVenueLayoutId; }
    public void setSourceVenueLayoutId(Long sourceVenueLayoutId) { this.sourceVenueLayoutId = sourceVenueLayoutId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTemplateType() { return templateType; }
    public void setTemplateType(String templateType) { this.templateType = templateType; }
    public String getStageTitle() { return stageTitle; }
    public void setStageTitle(String stageTitle) { this.stageTitle = stageTitle; }
    public Integer getStageX() { return stageX; }
    public void setStageX(Integer stageX) { this.stageX = stageX; }
    public Integer getStageY() { return stageY; }
    public void setStageY(Integer stageY) { this.stageY = stageY; }
    public Integer getCanvasWidth() { return canvasWidth; }
    public void setCanvasWidth(Integer canvasWidth) { this.canvasWidth = canvasWidth; }
    public Integer getCanvasHeight() { return canvasHeight; }
    public void setCanvasHeight(Integer canvasHeight) { this.canvasHeight = canvasHeight; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
