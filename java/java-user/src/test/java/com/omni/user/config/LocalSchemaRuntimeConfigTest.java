package com.omni.user.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalSchemaRuntimeConfigTest {

    @Test
    void localSchemaProvidesDevelopmentOnlyIdNoKeyFallback() throws Exception {
        String yaml = new String(
                getClass().getClassLoader().getResourceAsStream("application-local-schema.yml").readAllBytes(),
                StandardCharsets.UTF_8
        );

        assertTrue(yaml.contains("id-no-key: ${OMNI_ID_NO_KEY:omni-local-dev-id-no-key-change-me}"));
    }
}
