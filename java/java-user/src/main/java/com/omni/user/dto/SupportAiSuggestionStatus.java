package com.omni.user.dto;

import java.util.Set;

public enum SupportAiSuggestionStatus {
    GENERATING,
    READY,
    ACCEPTED,
    ACCEPTED_EDITED,
    REJECTED,
    EXPIRED,
    FAILED;

    private static final Set<String> VALUES = Set.of(
            "GENERATING", "READY", "ACCEPTED", "ACCEPTED_EDITED",
            "REJECTED", "EXPIRED", "FAILED");

    public static boolean isAllowed(String value) {
        return value != null && VALUES.contains(value);
    }

    public static String require(String value) {
        if (!isAllowed(value)) {
            throw new IllegalArgumentException("非法 AI 建议状态");
        }
        return value;
    }
}
