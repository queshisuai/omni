package com.omni.payment.dto;

import java.util.List;

public class MarkPartialRefundedRequest {
    private Integer quantity;
    private List<Long> orderSeatIds;

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getOrderSeatIds() { return orderSeatIds; }
    public void setOrderSeatIds(List<Long> orderSeatIds) { this.orderSeatIds = orderSeatIds; }
}
