package com.omni.order.dto;

public class SessionSeatUsageItemResponse {
    private Long sessionSeatId;
    private Boolean usedByOrder;
    private Boolean editable;
    private Long orderId;
    private Integer orderSeatStatus;

    public SessionSeatUsageItemResponse() {
    }

    public SessionSeatUsageItemResponse(Long sessionSeatId, Boolean usedByOrder, Boolean editable, Long orderId, Integer orderSeatStatus) {
        this.sessionSeatId = sessionSeatId;
        this.usedByOrder = usedByOrder;
        this.editable = editable;
        this.orderId = orderId;
        this.orderSeatStatus = orderSeatStatus;
    }

    public Long getSessionSeatId() {
        return sessionSeatId;
    }

    public void setSessionSeatId(Long sessionSeatId) {
        this.sessionSeatId = sessionSeatId;
    }

    public Boolean getUsedByOrder() {
        return usedByOrder;
    }

    public void setUsedByOrder(Boolean usedByOrder) {
        this.usedByOrder = usedByOrder;
    }

    public Boolean getEditable() {
        return editable;
    }

    public void setEditable(Boolean editable) {
        this.editable = editable;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public Integer getOrderSeatStatus() {
        return orderSeatStatus;
    }

    public void setOrderSeatStatus(Integer orderSeatStatus) {
        this.orderSeatStatus = orderSeatStatus;
    }
}
