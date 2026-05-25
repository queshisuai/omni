package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("seat_layout_version_group_binding")
public class SeatLayoutVersionGroupBinding {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long versionId;
    private String blockKey;
    private String groupKey;
    private String bindingRole;
    private Integer sort;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVersionId() { return versionId; }
    public void setVersionId(Long versionId) { this.versionId = versionId; }
    public String getBlockKey() { return blockKey; }
    public void setBlockKey(String blockKey) { this.blockKey = blockKey; }
    public String getGroupKey() { return groupKey; }
    public void setGroupKey(String groupKey) { this.groupKey = groupKey; }
    public String getBindingRole() { return bindingRole; }
    public void setBindingRole(String bindingRole) { this.bindingRole = bindingRole; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
