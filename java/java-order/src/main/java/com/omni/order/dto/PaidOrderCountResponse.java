package com.omni.order.dto;

public class PaidOrderCountResponse {

    private Long paidOrderCount;

    public PaidOrderCountResponse() {
    }

    public PaidOrderCountResponse(Long paidOrderCount) {
        this.paidOrderCount = paidOrderCount;
    }

    public Long getPaidOrderCount() {
        return paidOrderCount;
    }

    public void setPaidOrderCount(Long paidOrderCount) {
        this.paidOrderCount = paidOrderCount;
    }
}
