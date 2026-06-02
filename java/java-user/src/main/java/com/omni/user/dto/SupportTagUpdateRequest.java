package com.omni.user.dto;

import java.util.List;

public class SupportTagUpdateRequest {
    private List<String> tags;

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
