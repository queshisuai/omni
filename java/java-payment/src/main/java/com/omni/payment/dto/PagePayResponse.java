package com.omni.payment.dto;

public class PagePayResponse {

    private Long orderId;
    private String orderNo;
    private String payForm;

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

    public String getPayForm() {
        return payForm;
    }

    public void setPayForm(String payForm) {
        this.payForm = payForm;
    }
}
