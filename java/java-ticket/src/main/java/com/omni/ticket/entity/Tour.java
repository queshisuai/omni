package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("tour")
public class Tour {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private Long artistId;
    @TableField("category_id")
    private Long categoryId;
    private String poster;
    private String description;
    private Long organizerId;
    private String reviewStatus;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getPoster() { return poster; }
    public void setPoster(String poster) { this.poster = poster; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
