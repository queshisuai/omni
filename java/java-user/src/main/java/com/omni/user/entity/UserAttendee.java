package com.omni.user.entity;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("user_attendee")
@KeySequence(value = "user_attendee_id_seq", dbType = DbType.POSTGRE_SQL)
public class UserAttendee {
    @TableId(type = IdType.INPUT)
    private Long id;
    private Long userId;
    private String realName;
    private String idType;
    private String idNoHash;
    private String idNoMask;
    private String idNoEncrypted;
    private String phone;
    private Boolean isDefault;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNoHash() { return idNoHash; }
    public void setIdNoHash(String idNoHash) { this.idNoHash = idNoHash; }
    public String getIdNoMask() { return idNoMask; }
    public void setIdNoMask(String idNoMask) { this.idNoMask = idNoMask; }
    public String getIdNoEncrypted() { return idNoEncrypted; }
    public void setIdNoEncrypted(String idNoEncrypted) { this.idNoEncrypted = idNoEncrypted; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
