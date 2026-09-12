package com.omni.ticket.dto;

public class ActivityQuestionUpdateRequest {
    private String answer;
    private String replyIdentity;
    private String status;
    private String reason;

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public String getReplyIdentity() { return replyIdentity; }
    public void setReplyIdentity(String replyIdentity) { this.replyIdentity = replyIdentity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
