package com.omni.ticket.dto;

public class DeactivateOrganizerRequest {

    private Long userId;
    private Long organizerId;
    private Boolean confirmRefund;
    private String reason;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getOrganizerId() {
        return organizerId;
    }

    public void setOrganizerId(Long organizerId) {
        this.organizerId = organizerId;
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
