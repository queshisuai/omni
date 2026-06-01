package com.omni.user.dto;

public class SupportConversationRequest {

    private String subject;
    private String initialMessage;
    private Boolean preferHuman;

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getInitialMessage() { return initialMessage; }
    public void setInitialMessage(String initialMessage) { this.initialMessage = initialMessage; }

    public Boolean getPreferHuman() { return preferHuman; }
    public void setPreferHuman(Boolean preferHuman) { this.preferHuman = preferHuman; }
}
