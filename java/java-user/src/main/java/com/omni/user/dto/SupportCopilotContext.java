package com.omni.user.dto;

import com.omni.user.entity.SupportConversation;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SupportCopilotContext {
    private Long conversationId;
    private Long messageCutoff;
    private String contextDigest;
    private SupportConversation conversation;
    private SupportContextResponse businessContext;
    private List<SupportCopilotMessage> messages = new ArrayList<>();
    private Map<String, String> facts;

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getMessageCutoff() { return messageCutoff; }
    public void setMessageCutoff(Long messageCutoff) { this.messageCutoff = messageCutoff; }
    public String getContextDigest() { return contextDigest; }
    public void setContextDigest(String contextDigest) { this.contextDigest = contextDigest; }
    public SupportConversation getConversation() { return conversation; }
    public void setConversation(SupportConversation conversation) { this.conversation = conversation; }
    public SupportContextResponse getBusinessContext() { return businessContext; }
    public void setBusinessContext(SupportContextResponse businessContext) { this.businessContext = businessContext; }
    public List<SupportCopilotMessage> getMessages() { return messages; }
    public void setMessages(List<SupportCopilotMessage> messages) {
        this.messages = messages == null ? new ArrayList<>() : messages;
    }
    public Map<String, String> getFacts() { return facts; }
    public void setFacts(Map<String, String> facts) { this.facts = facts; }

    public static class SupportCopilotMessage {
        private Long id;
        private String senderType;
        private String content;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getSenderType() { return senderType; }
        public void setSenderType(String senderType) { this.senderType = senderType; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
