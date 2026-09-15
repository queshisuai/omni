package com.omni.ai.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class AiResponse {
    private final String requestId;
    private final String model;
    private final String text;
    private final String finishReason;
    private final AiUsage usage;
    private final long latencyMillis;

    @JsonCreator
    public AiResponse(@JsonProperty("requestId") String requestId, @JsonProperty("model") String model, @JsonProperty("text") String text, @JsonProperty("finishReason") String finishReason, @JsonProperty("usage") AiUsage usage, @JsonProperty("latencyMillis") long latencyMillis) {
        this.requestId = requestId;
        this.model = model;
        this.text = text;
        this.finishReason = finishReason;
        this.usage = usage;
        this.latencyMillis = latencyMillis;
    }

    public String getRequestId() { return requestId; }

    public String getModel() { return model; }

    public String getText() { return text; }

    public String getFinishReason() { return finishReason; }

    public AiUsage getUsage() { return usage; }

    public long getLatencyMillis() { return latencyMillis; }
}
