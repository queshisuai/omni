package com.omni.user.service;

import com.omni.ai.prompt.PromptTemplate;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupportPromptCompatibilityTest {
    private static final String ORIGINAL_SHA256 = "4c51245bbd1f5cf30a3d4cd9124b3280a18c3ab049bb732790a862cb7275bee5";

    @Test
    void keepsExactLegacySystemPromptIncludingWhitespace() throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(SupportKnowledgeBase.projectKnowledge().getBytes(StandardCharsets.UTF_8));
        StringBuilder hash = new StringBuilder();
        for (byte value : digest) {
            hash.append(String.format("%02x", value & 0xff));
        }
        assertEquals(ORIGINAL_SHA256, hash.toString());
    }

    @Test
    void usesVersionedResourceWithTheLegacyFingerprint() {
        PromptTemplate template = PromptTemplate.fromResource(SupportKnowledgeBase.class,
                "/prompts/support-local-v1.txt", "support-local", "v1", Set.of());
        assertEquals(ORIGINAL_SHA256, template.getVersion().getSha256());
        assertEquals(template.render(Map.of()), SupportKnowledgeBase.projectKnowledge());
    }
}
