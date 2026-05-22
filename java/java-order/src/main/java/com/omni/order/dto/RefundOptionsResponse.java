package com.omni.order.dto;

import java.math.BigDecimal;
import java.util.List;

public class RefundOptionsResponse {
    private Long orderId;
    private Integer totalQuantity;
    private Integer refundedQuantity;
    private Integer refundableQuantity;
    private BigDecimal unitPrice;
    private List<RefundSeatOptionResponse> seats;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Integer getTotalQuantity() { return totalQuantity; }
    public void setTotalQuantity(Integer totalQuantity) { this.totalQuantity = totalQuantity; }
    public Integer getRefundedQuantity() { return refundedQuantity; }
    public void setRefundedQuantity(Integer refundedQuantity) { this.refundedQuantity = refundedQuantity; }
    public Integer getRefundableQuantity() { return refundableQuantity; }
    public void setRefundableQuantity(Integer refundableQuantity) { this.refundableQuantity = refundableQuantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public List<RefundSeatOptionResponse> getSeats() { return seats; }
    public void setSeats(List<RefundSeatOptionResponse> seats) { this.seats = seats; }
}
