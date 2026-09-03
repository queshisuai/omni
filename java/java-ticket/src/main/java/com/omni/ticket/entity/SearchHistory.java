package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("search_history")
public class SearchHistory {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String keyword;
    private Integer searchCount;
    private LocalDateTime lastSearchedAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public Integer getSearchCount() { return searchCount; }
    public void setSearchCount(Integer searchCount) { this.searchCount = searchCount; }
    public LocalDateTime getLastSearchedAt() { return lastSearchedAt; }
    public void setLastSearchedAt(LocalDateTime lastSearchedAt) { this.lastSearchedAt = lastSearchedAt; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
