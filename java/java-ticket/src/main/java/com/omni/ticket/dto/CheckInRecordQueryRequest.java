package com.omni.ticket.dto;

public class CheckInRecordQueryRequest {
    private Long sessionId;
    private String result;
    private Integer page;
    private Integer size;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Integer getPage() { return page; }
    public void setPage(Integer page) { this.page = page; }
    public Integer getSize() { return size; }
    public void setSize(Integer size) { this.size = size; }
}
