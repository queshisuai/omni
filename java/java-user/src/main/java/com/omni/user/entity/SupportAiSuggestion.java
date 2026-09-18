package com.omni.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("support_ai_suggestion")
public class SupportAiSuggestion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long conversationId;
    private Long agentId;
    private Long messageCutoff;
    private String contextDigest;
    private String suggestionText;
    private String summary;
    private String issueType;
    private String recommendedAction;
    private String missingInformation = "[]";
    private String sourceEvidence = "[]";
    private String model;
    private String promptVersion;
    private String status;
    private String editedText;
    private String failureCode;
    private String failureReason;
    private String rejectReason;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime acceptedAt;
    private LocalDateTime editedAt;
    private LocalDateTime rejectedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getAgentId() { return agentId; }
    public void setAgentId(Long agentId) { this.agentId = agentId; }
    public Long getMessageCutoff() { return messageCutoff; }
    public void setMessageCutoff(Long messageCutoff) { this.messageCutoff = messageCutoff; }
    public String getContextDigest() { return contextDigest; }
    public void setContextDigest(String contextDigest) { this.contextDigest = contextDigest; }
    public String getSuggestionText() { return suggestionText; }
    public void setSuggestionText(String suggestionText) { this.suggestionText = suggestionText; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getIssueType() { return issueType; }
    public void setIssueType(String issueType) { this.issueType = issueType; }
    public String getRecommendedAction() { return recommendedAction; }
    public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }
    public String getMissingInformation() { return missingInformation; }
    public void setMissingInformation(String missingInformation) { this.missingInformation = missingInformation; }
    public String getSourceEvidence() { return sourceEvidence; }
    public void setSourceEvidence(String sourceEvidence) { this.sourceEvidence = sourceEvidence; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String promptVersion) { this.promptVersion = promptVersion; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getEditedText() { return editedText; }
    public void setEditedText(String editedText) { this.editedText = editedText; }
    public String getFailureCode() { return failureCode; }
    public void setFailureCode(String failureCode) { this.failureCode = failureCode; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
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
