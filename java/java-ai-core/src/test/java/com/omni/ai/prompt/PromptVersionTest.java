package com.omni.ai.prompt;

import org.junit.jupiter.api.Test;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class PromptVersionTest {
    @Test
    void fingerprintsExactTemplateContent() {
        PromptVersion version = new PromptTemplate("support", "v1", "abc", Set.of()).getVersion();
        assertEquals("support", version.getTemplateId());
        assertEquals("v1", version.getVersion());
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", version.getSha256());
        assertNotEquals(version.getSha256(), new PromptTemplate("support", "v1", "abc\n", Set.of()).getVersion().getSha256());
    }
}
