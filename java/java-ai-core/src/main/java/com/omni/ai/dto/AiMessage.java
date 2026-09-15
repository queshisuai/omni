package com.omni.ai.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class AiMessage {
    private final String role;
    private final String content;

    @JsonCreator
    public AiMessage(@JsonProperty("role") String role, @JsonProperty("content") String content) {
        this.role = role;
        this.content = content;
    }

    public String getRole() { return role; }

    public String getContent() { return content; }
}
