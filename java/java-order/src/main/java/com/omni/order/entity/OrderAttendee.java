package com.omni.order.entity;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("order_attendee")
@KeySequence(value = "order_attendee_id_seq", dbType = DbType.POSTGRE_SQL)
public class OrderAttendee {
    @TableId(type = IdType.INPUT)
    private Long id;
    private Long orderId;
    private Long orderSeatId;
    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private Long attendeeUserProfileId;
    private String realName;
    private String idType;
    private String idNoHash;
    private String idNoMask;
    private String idNoEncrypted;
    private String phone;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getOrderSeatId() { return orderSeatId; }
    public void setOrderSeatId(Long orderSeatId) { this.orderSeatId = orderSeatId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Long getAttendeeUserProfileId() { return attendeeUserProfileId; }
    public void setAttendeeUserProfileId(Long attendeeUserProfileId) { this.attendeeUserProfileId = attendeeUserProfileId; }
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
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
