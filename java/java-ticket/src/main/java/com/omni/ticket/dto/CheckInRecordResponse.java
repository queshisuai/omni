package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class CheckInRecordResponse {
    private Long id;
    private String requestId;
    private Long ticketId;
    private String ticketNo;
    private Long orderId;
    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private String deviceCode;
    private Long operatorUserId;
    private String channel;
    private String result;
    private String failureReason;
    private LocalDateTime checkedInAt;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public String getTicketNo() { return ticketNo; }
    public void setTicketNo(String ticketNo) { this.ticketNo = ticketNo; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public Long getOperatorUserId() { return operatorUserId; }
    public void setOperatorUserId(Long operatorUserId) { this.operatorUserId = operatorUserId; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
    public void setCheckedInAt(LocalDateTime checkedInAt) { this.checkedInAt = checkedInAt; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
