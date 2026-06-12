package com.omni.ticket.search;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivitySearchPropertiesTest {

    @Test
    void defaultsToDbProviderForLocalSafety() {
        ActivitySearchProperties properties = new ActivitySearchProperties();

        assertEquals("db", properties.getProvider());
        assertEquals("omni_activity_v1", properties.getIndexName());
        assertEquals("omni_activity_current", properties.getAliasName());
        assertFalse(properties.isRequireElasticsearch());
    }

    @Test
    void bindsElasticsearchProviderSettings() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "omni.search.provider", "elasticsearch",
                "omni.search.require-elasticsearch", "true",
                "omni.search.index-name", "omni_activity_v20260606",
                "omni.search.alias-name", "omni_activity_current"
        )));

        ActivitySearchProperties properties = new Binder(ConfigurationPropertySources.get(environment))
                .bind("omni.search", ActivitySearchProperties.class)
                .orElseThrow(() -> new AssertionError("omni.search 配置绑定失败"));

        assertEquals("elasticsearch", properties.getProvider());
        assertTrue(properties.isRequireElasticsearch());
        assertEquals("omni_activity_v20260606", properties.getIndexName());
        assertEquals("omni_activity_current", properties.getAliasName());
    }
}
