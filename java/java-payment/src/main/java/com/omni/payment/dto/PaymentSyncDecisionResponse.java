package com.omni.payment.dto;

public class PaymentSyncDecisionResponse {

    private Long orderId;
    private String orderNo;
    private Integer orderStatus;
    private Integer paymentStatus;
    private Boolean paid;
    private Boolean safeToCancel;
    private String tradeNo;
    private String message;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Integer getOrderStatus() { return orderStatus; }
    public void setOrderStatus(Integer orderStatus) { this.orderStatus = orderStatus; }
    public Integer getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(Integer paymentStatus) { this.paymentStatus = paymentStatus; }
    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }
    public Boolean getSafeToCancel() { return safeToCancel; }
    public void setSafeToCancel(Boolean safeToCancel) { this.safeToCancel = safeToCancel; }
    public String getTradeNo() { return tradeNo; }
    public void setTradeNo(String tradeNo) { this.tradeNo = tradeNo; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
