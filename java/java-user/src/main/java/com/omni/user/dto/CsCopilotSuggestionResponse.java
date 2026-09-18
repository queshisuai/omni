package com.omni.user.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class CsCopilotSuggestionResponse {
    private Long suggestionId;
    private Long conversationId;
    private Long agentId;
    private Long messageCutoff;
    private String contextDigest;
    private String status;
    private String suggestionText;
    private String summary;
    private String issueType;
    private String recommendedAction;
    private List<String> missingInformation = new ArrayList<>();
    private List<CsCopilotSourceEvidenceResponse> sourceEvidence = new ArrayList<>();
    private String editedText;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime acceptedAt;
    private LocalDateTime editedAt;
    private LocalDateTime rejectedAt;

    public Long getSuggestionId() { return suggestionId; }
    public void setSuggestionId(Long suggestionId) { this.suggestionId = suggestionId; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getAgentId() { return agentId; }
    public void setAgentId(Long agentId) { this.agentId = agentId; }
    public Long getMessageCutoff() { return messageCutoff; }
    public void setMessageCutoff(Long messageCutoff) { this.messageCutoff = messageCutoff; }
    public String getContextDigest() { return contextDigest; }
    public void setContextDigest(String contextDigest) { this.contextDigest = contextDigest; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSuggestionText() { return suggestionText; }
    public void setSuggestionText(String suggestionText) { this.suggestionText = suggestionText; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getIssueType() { return issueType; }
    public void setIssueType(String issueType) { this.issueType = issueType; }
    public String getRecommendedAction() { return recommendedAction; }
    public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }
    public List<String> getMissingInformation() { return missingInformation; }
    public void setMissingInformation(List<String> missingInformation) {
        this.missingInformation = missingInformation == null ? new ArrayList<>() : missingInformation;
    }
    public List<CsCopilotSourceEvidenceResponse> getSourceEvidence() { return sourceEvidence; }
    public void setSourceEvidence(List<CsCopilotSourceEvidenceResponse> sourceEvidence) {
        this.sourceEvidence = sourceEvidence == null ? new ArrayList<>() : sourceEvidence;
    }
    public String getEditedText() { return editedText; }
    public void setEditedText(String editedText) { this.editedText = editedText; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(LocalDateTime acceptedAt) { this.acceptedAt = acceptedAt; }
    public LocalDateTime getEditedAt() { return editedAt; }
    public void setEditedAt(LocalDateTime editedAt) { this.editedAt = editedAt; }
    public LocalDateTime getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(LocalDateTime rejectedAt) { this.rejectedAt = rejectedAt; }
}
