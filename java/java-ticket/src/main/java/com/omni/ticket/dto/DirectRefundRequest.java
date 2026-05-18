package com.omni.ticket.dto;

public class DirectRefundRequest {

    private Long orderId;
    private String reason;

    public DirectRefundRequest() {
    }

    public DirectRefundRequest(Long orderId, String reason) {
        this.orderId = orderId;
        this.reason = reason;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
