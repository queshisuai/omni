package com.omni.ticket.search;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SearchPropertiesTest {

    @Test
    void bindsElasticsearchSettingsWithSafeDefaults() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("omni.search.es.enabled", "true")
                .withProperty("omni.search.es.uris", "http://localhost:9200")
                .withProperty("omni.search.es.index-alias", "omni_activity_search_current")
                .withProperty("omni.search.es.connect-timeout-ms", "800")
                .withProperty("omni.search.es.read-timeout-ms", "1200");

        SearchProperties properties = Binder.get(env)
                .bind("omni.search", SearchProperties.class)
                .orElseThrow(IllegalStateException::new);

        assertTrue(properties.getEs().isEnabled());
        assertEquals("http://localhost:9200", properties.getEs().getUris());
        assertEquals("omni_activity_search_current", properties.getEs().getIndexAlias());
        assertEquals(800, properties.getEs().getConnectTimeoutMs());
        assertEquals(1200, properties.getEs().getReadTimeoutMs());
    }
}
