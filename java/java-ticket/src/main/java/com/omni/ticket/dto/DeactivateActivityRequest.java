package com.omni.ticket.dto;

public class DeactivateActivityRequest {

    private Long userId;
    private Boolean confirmRefund;
    private String reason;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Boolean getConfirmRefund() {
        return confirmRefund;
    }

    public void setConfirmRefund(Boolean confirmRefund) {
        this.confirmRefund = confirmRefund;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
