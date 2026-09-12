package com.omni.common.util;

import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalProdSplitDefaultsTest {

    @Test
    void addsUserDefaultsForLocalProdSplitClassesLaunch() {
        Properties properties = localClassesProperties();

        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-user",
                new String[]{"--spring.profiles.active=prod-split"},
                properties,
                Collections.emptyMap());

        assertEquals("123456", defaults.get("SPRING_DATASOURCE_PASSWORD"));
        assertEquals("localhost", defaults.get("NACOS_HOST"));
        assertEquals("5672", defaults.get("RABBITMQ_PORT"));
        assertEquals("omni-local-internal-token", defaults.get("INTERNAL_API_TOKEN"));
        assertEquals("http://localhost:3001", defaults.get("GRAB_SERVICE_URL"));
        assertEquals("omni-local-dev-id-no-key-change-me", defaults.get("OMNI_ID_NO_KEY"));
    }

    @Test
    void addsTicketSearchAndSeataDefaultsForLocalProdSplitClassesLaunch() {
        Properties properties = localClassesProperties();

        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-ticket",
                new String[]{"--spring.profiles.active=prod-split"},
                properties,
                Collections.emptyMap());

        assertEquals("true", defaults.get("SEATA_ENABLED"));
        assertEquals("http://localhost:9200", defaults.get("ELASTICSEARCH_URIS"));
        assertEquals("http://localhost:9200", defaults.get("SPRING_ELASTICSEARCH_URIS"));
    }

    @Test
    void addsPaymentAlipayPlaceholdersForLocalProdSplitClassesLaunch() {
        Properties properties = localClassesProperties();

        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-payment",
                new String[]{"--spring.profiles.active=prod-split"},
                properties,
                Collections.emptyMap());

        assertEquals("true", defaults.get("SEATA_ENABLED"));
        assertEquals("http://localhost:8084/local-alipay-disabled", defaults.get("ALIPAY_GATEWAY_URL"));
        assertEquals("omni-local-placeholder", defaults.get("ALIPAY_APP_ID"));
        assertEquals("http://localhost:3000/payment/result", defaults.get("ALIPAY_RETURN_URL"));
    }

    @Test
    void skipsDefaultsWhenProdSplitIsNotActive() {
        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-user",
                new String[0],
                localClassesProperties(),
                Collections.emptyMap());

        assertTrue(defaults.isEmpty());
    }

    @Test
    void skipsDefaultsForJarLaunch() {
        Properties properties = new Properties();
        properties.setProperty("java.class.path", "D:\\Project\\omni\\java-user.jar");

        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-user",
                new String[]{"--spring.profiles.active=prod-split"},
                properties,
                Collections.emptyMap());

        assertTrue(defaults.isEmpty());
    }

    @Test
    void keepsExplicitEnvironmentValues() {
        Properties properties = localClassesProperties();

        Map<String, Object> defaults = LocalProdSplitDefaults.buildDefaultProperties(
                "java-user",
                new String[]{"--spring.profiles.active=prod-split"},
                properties,
                Map.of("GRAB_SERVICE_URL", "http://grab.local:3001"));

        assertFalse(defaults.containsKey("GRAB_SERVICE_URL"));
    }

    private static Properties localClassesProperties() {
        Properties properties = new Properties();
        properties.setProperty("java.class.path", "D:\\Project\\omni\\java\\java-user\\target\\classes");
        return properties;
    }
}
