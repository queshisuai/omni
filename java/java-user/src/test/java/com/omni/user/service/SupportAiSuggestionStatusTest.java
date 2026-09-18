package com.omni.user.service;

import com.omni.user.dto.SupportAiSuggestionStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportAiSuggestionStatusTest {

    @Test
    void acceptsOnlyTheLockedSuggestionStatuses() {
        for (String value : new String[]{
                "GENERATING", "READY", "ACCEPTED", "ACCEPTED_EDITED",
                "REJECTED", "EXPIRED", "FAILED"
        }) {
            assertTrue(SupportAiSuggestionStatus.isAllowed(value));
        }
        assertThrows(IllegalArgumentException.class,
                () -> SupportAiSuggestionStatus.require("UNKNOWN"));
    }
}
