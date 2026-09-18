package com.omni.user.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

@JsonIgnoreProperties(ignoreUnknown = false)
public class SupportCopilotModelOutput {
    private String suggestionText;
    private String summary;
    private String issueType;
    private String recommendedAction;
    private List<String> missingInformation = new ArrayList<>();
    private List<SourceEvidenceItem> sourceEvidence = new ArrayList<>();
    private transient String model;

    public static SupportCopilotModelOutput parseStrict(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper()
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);
            JsonNode root = mapper.readTree(json);
            validateSchema(root);
            return mapper.treeToValue(root, SupportCopilotModelOutput.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("模型输出格式无效", e);
        }
    }

    private static void validateSchema(JsonNode root) {
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("模型输出必须是 JSON 对象");
        }
        Set<String> allowed = new HashSet<>(Arrays.asList(
                "suggestionText", "summary", "issueType", "recommendedAction",
                "missingInformation", "sourceEvidence"));
        Iterator<String> fields = root.fieldNames();
        while (fields.hasNext()) {
            if (!allowed.contains(fields.next())) {
                throw new IllegalArgumentException("模型输出包含未知字段");
            }
        }
        requireText(root, "suggestionText");
        requireArray(root, "sourceEvidence");
        validateOptionalText(root, "summary");
        validateOptionalText(root, "issueType");
        validateOptionalText(root, "recommendedAction");
        if (root.has("missingInformation")) {
            requireArray(root, "missingInformation");
            for (JsonNode item : root.get("missingInformation")) {
                if (!item.isTextual()) {
                    throw new IllegalArgumentException("missingInformation 必须是字符串数组");
                }
            }
        }
        for (JsonNode item : root.get("sourceEvidence")) {
            if (!item.isObject()) {
                throw new IllegalArgumentException("sourceEvidence 必须是对象数组");
            }
            Iterator<String> itemFields = item.fieldNames();
            while (itemFields.hasNext()) {
                if (!"factKey".equals(itemFields.next())) {
                    throw new IllegalArgumentException("sourceEvidence 只允许包含 factKey");
                }
            }
            requireText(item, "factKey");
        }
    }

    private static void validateOptionalText(JsonNode root, String field) {
        if (root.has(field) && !root.get(field).isTextual()) {
            throw new IllegalArgumentException(field + " 必须是字符串");
        }
    }

    private static void requireText(JsonNode node, String field) {
        if (!node.has(field) || !node.get(field).isTextual()) {
            throw new IllegalArgumentException(field + " 必须是字符串");
        }
    }

    private static void requireArray(JsonNode node, String field) {
        if (!node.has(field) || !node.get(field).isArray()) {
            throw new IllegalArgumentException(field + " 必须是数组");
        }
    }

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

    public List<SourceEvidenceItem> getSourceEvidence() { return sourceEvidence; }
    public void setSourceEvidence(List<SourceEvidenceItem> sourceEvidence) {
        this.sourceEvidence = sourceEvidence == null ? new ArrayList<>() : sourceEvidence;
    }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public static class SourceEvidenceItem {
        private String factKey;

        public String getFactKey() { return factKey; }
        public void setFactKey(String factKey) { this.factKey = factKey; }
    }
}
