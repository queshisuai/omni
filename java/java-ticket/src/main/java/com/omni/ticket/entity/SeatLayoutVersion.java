package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("seat_layout_version")
public class SeatLayoutVersion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String ownerType;
    private Long ownerId;
    private Integer versionNo;
    private String versionStatus;
    private String name;
    private String templateType;
    private String stageTitle;
    private Integer stageX;
    private Integer stageY;
    private Integer canvasWidth;
    private Integer canvasHeight;
    private Long baseVersionId;
    private LocalDateTime publishedAt;
    private Long publishedBy;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOwnerType() { return ownerType; }
    public void setOwnerType(String ownerType) { this.ownerType = ownerType; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public Integer getVersionNo() { return versionNo; }
    public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
    public String getVersionStatus() { return versionStatus; }
    public void setVersionStatus(String versionStatus) { this.versionStatus = versionStatus; }
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
    public Long getBaseVersionId() { return baseVersionId; }
    public void setBaseVersionId(Long baseVersionId) { this.baseVersionId = baseVersionId; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    public Long getPublishedBy() { return publishedBy; }
    public void setPublishedBy(Long publishedBy) { this.publishedBy = publishedBy; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
