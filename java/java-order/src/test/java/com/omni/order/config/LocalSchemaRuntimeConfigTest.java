package com.omni.order.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalSchemaRuntimeConfigTest {

    @Test
    void localSchemaDisablesSeataByDefault() throws Exception {
        String yaml = new String(
                getClass().getClassLoader().getResourceAsStream("application-local-schema.yml").readAllBytes(),
                StandardCharsets.UTF_8
        );

        assertTrue(yaml.contains("enabled: ${SEATA_ENABLED:false}"));
    }

    @Test
    void prodSplitAllowsSeataToBeDisabledExplicitly() throws Exception {
        String yaml = new String(
                getClass().getClassLoader().getResourceAsStream("application-prod-split.yml").readAllBytes(),
                StandardCharsets.UTF_8
        );

        assertTrue(yaml.contains("enabled: ${SEATA_ENABLED:true}"));
    }
}
