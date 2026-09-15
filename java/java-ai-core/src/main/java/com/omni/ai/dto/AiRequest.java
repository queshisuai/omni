package com.omni.ai.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class AiRequest {
    private final String requestId;
    private final String model;
    private final String systemPrompt;
    private final List<AiMessage> messages;
    private final Double temperature;
    private final Integer maxTokens;
    private final Integer contextWindow;
    private final JsonNode responseFormat;

    public AiRequest(@JsonProperty("requestId") String requestId, @JsonProperty("model") String model, @JsonProperty("systemPrompt") String systemPrompt, @JsonProperty("messages") List<AiMessage> messages, @JsonProperty("temperature") Double temperature, @JsonProperty("maxTokens") Integer maxTokens, @JsonProperty("contextWindow") Integer contextWindow) {
        this(requestId, model, systemPrompt, messages, temperature, maxTokens, contextWindow, null);
    }

    @JsonCreator
    public AiRequest(@JsonProperty("requestId") String requestId,
                     @JsonProperty("model") String model,
                     @JsonProperty("systemPrompt") String systemPrompt,
                     @JsonProperty("messages") List<AiMessage> messages,
                     @JsonProperty("temperature") Double temperature,
                     @JsonProperty("maxTokens") Integer maxTokens,
                     @JsonProperty("contextWindow") Integer contextWindow,
                     @JsonProperty("responseFormat") JsonNode responseFormat) {
        this.requestId = requestId;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.messages = messages == null ? List.of() : List.copyOf(messages);
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.contextWindow = contextWindow;
        this.responseFormat = responseFormat == null ? null : responseFormat.deepCopy();
    }

    public String getRequestId() { return requestId; }

    public String getModel() { return model; }

    public String getSystemPrompt() { return systemPrompt; }

    public List<AiMessage> getMessages() { return messages; }

    public Double getTemperature() { return temperature; }

    public Integer getMaxTokens() { return maxTokens; }

    public Integer getContextWindow() { return contextWindow; }

    public JsonNode getResponseFormat() {
        return responseFormat == null ? null : responseFormat.deepCopy();
    }
}
