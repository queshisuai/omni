package com.omni.ticket.dto;

public class ActivityQuestionReplyRequest {
    private String answer;
    private String replyIdentity;

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public String getReplyIdentity() { return replyIdentity; }
    public void setReplyIdentity(String replyIdentity) { this.replyIdentity = replyIdentity; }
}
