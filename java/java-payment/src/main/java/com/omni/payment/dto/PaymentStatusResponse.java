package com.omni.payment.dto;

public class PaymentStatusResponse {

    private Long orderId;
    private String orderNo;
    private Integer orderStatus;
    private Integer paymentStatus;
    private String tradeNo;
    private String message;
    private Boolean statusConfirmed;

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public Integer getOrderStatus() {
        return orderStatus;
    }

    public void setOrderStatus(Integer orderStatus) {
        this.orderStatus = orderStatus;
    }

    public Integer getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(Integer paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getTradeNo() {
        return tradeNo;
    }

    public void setTradeNo(String tradeNo) {
        this.tradeNo = tradeNo;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getStatusConfirmed() {
        return statusConfirmed;
    }

    public void setStatusConfirmed(Boolean statusConfirmed) {
        this.statusConfirmed = statusConfirmed;
    }
}
