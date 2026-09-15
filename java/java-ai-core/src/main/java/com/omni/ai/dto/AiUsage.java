package com.omni.ai.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class AiUsage {
    private final Long inputTokens;
    private final Long outputTokens;
    private final Long totalTokens;

    @JsonCreator
    public AiUsage(@JsonProperty("inputTokens") Long inputTokens, @JsonProperty("outputTokens") Long outputTokens, @JsonProperty("totalTokens") Long totalTokens) {
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.totalTokens = totalTokens;
    }

    public Long getInputTokens() { return inputTokens; }

    public Long getOutputTokens() { return outputTokens; }

    public Long getTotalTokens() { return totalTokens; }
}
