package com.omni.ticket.search;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.elasticsearch.RestClientBuilderCustomizer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ElasticsearchClientConfigTest {

    @Test
    void createsCustomizerWithSafeIoThreadCount() {
        ElasticsearchClientConfig config = new ElasticsearchClientConfig();

        RestClientBuilderCustomizer customizer = config.elasticsearchRestClientThreadCustomizer(0);

        assertNotNull(customizer);
        assertEquals(1, ElasticsearchClientConfig.normalizeIoThreadCount(0));
        assertEquals(1, ElasticsearchClientConfig.normalizeIoThreadCount(-1));
        assertEquals(4, ElasticsearchClientConfig.normalizeIoThreadCount(4));
    }
}
