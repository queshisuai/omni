package com.omni.order.dto;

public class TicketCheckInSyncRequest {
    private String requestId;
    private String entryCode;
    private String deviceCode;
    private Long operatorUserId;
    private String channel;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getEntryCode() { return entryCode; }
    public void setEntryCode(String entryCode) { this.entryCode = entryCode; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public Long getOperatorUserId() { return operatorUserId; }
    public void setOperatorUserId(Long operatorUserId) { this.operatorUserId = operatorUserId; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
}
