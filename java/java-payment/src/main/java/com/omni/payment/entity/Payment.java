package com.omni.payment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 支付记录
 */
@TableName("payment")
public class Payment {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long orderId;
    private String paymentNo;
    private String paymentMethod;
    private String outTradeNo;
    private String tradeNo;
    private String buyerId;
    private BigDecimal amount;
    /** 状态: 0=待支付, 1=支付成功, 2=支付失败 */
    private Integer status;
    private String callbackData;
    private LocalDateTime notifyTime;
    private String rawNotify;
    private LocalDateTime payTime;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getPaymentNo() { return paymentNo; }
    public void setPaymentNo(String paymentNo) { this.paymentNo = paymentNo; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getOutTradeNo() { return outTradeNo; }
    public void setOutTradeNo(String outTradeNo) { this.outTradeNo = outTradeNo; }
    public String getTradeNo() { return tradeNo; }
    public void setTradeNo(String tradeNo) { this.tradeNo = tradeNo; }
    public String getBuyerId() { return buyerId; }
    public void setBuyerId(String buyerId) { this.buyerId = buyerId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getCallbackData() { return callbackData; }
    public void setCallbackData(String callbackData) { this.callbackData = callbackData; }
    public LocalDateTime getNotifyTime() { return notifyTime; }
    public void setNotifyTime(LocalDateTime notifyTime) { this.notifyTime = notifyTime; }
    public String getRawNotify() { return rawNotify; }
    public void setRawNotify(String rawNotify) { this.rawNotify = rawNotify; }
    public LocalDateTime getPayTime() { return payTime; }
    public void setPayTime(LocalDateTime payTime) { this.payTime = payTime; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
