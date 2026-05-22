package com.omni.payment.dto;

import java.util.List;

public class ApplyRefundRequest {

    private Long orderId;
    private Long userId;
    private String reason;
    private String reasonType;
    private Integer quantity;
    private List<Long> orderSeatIds;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getReasonType() { return reasonType; }
    public void setReasonType(String reasonType) { this.reasonType = reasonType; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getOrderSeatIds() { return orderSeatIds; }
    public void setOrderSeatIds(List<Long> orderSeatIds) { this.orderSeatIds = orderSeatIds; }
}
