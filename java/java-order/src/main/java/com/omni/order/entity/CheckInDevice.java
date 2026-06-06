package com.omni.order.entity;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("check_in_device")
@KeySequence(value = "check_in_device_id_seq", dbType = DbType.POSTGRE_SQL)
public class CheckInDevice {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String deviceCode;
    private String deviceName;
    private Long organizerId;
    private Long sessionId;
    private Integer status;
    private String secretHash;
    private LocalDateTime lastSeenAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getDeviceName() { return deviceName; }
    public void setDeviceName(String deviceName) { this.deviceName = deviceName; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getSecretHash() { return secretHash; }
    public void setSecretHash(String secretHash) { this.secretHash = secretHash; }
    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
