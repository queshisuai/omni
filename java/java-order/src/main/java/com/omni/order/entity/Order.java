package com.omni.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单
 */
@TableName("\"order\"")
@KeySequence(value = "order_id_seq", dbType = DbType.POSTGRE_SQL)
public class Order {

    @TableId(type = IdType.INPUT)
    private Long id;
    private String orderNo;
    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private BigDecimal amount;
    /** 状态: 1=PENDING, 2=PAID, 3=CANCELLED, 4=REFUNDED */
    private Integer status;
    private Boolean userHidden;
    private LocalDateTime userDeletedAt;
    private LocalDateTime userDeleteExpiresAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Boolean getUserHidden() { return userHidden; }
    public void setUserHidden(Boolean userHidden) { this.userHidden = userHidden; }
    public LocalDateTime getUserDeletedAt() { return userDeletedAt; }
    public void setUserDeletedAt(LocalDateTime userDeletedAt) { this.userDeletedAt = userDeletedAt; }
    public LocalDateTime getUserDeleteExpiresAt() { return userDeleteExpiresAt; }
    public void setUserDeleteExpiresAt(LocalDateTime userDeleteExpiresAt) { this.userDeleteExpiresAt = userDeleteExpiresAt; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
