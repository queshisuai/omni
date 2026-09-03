package com.omni.gateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayRouteTimeoutConfigTest {

    @Test
    void gatewayHasGlobalConnectAndResponseTimeouts() {
        Properties properties = loadGatewayProperties();

        assertConfigDefault(properties, "spring.cloud.gateway.httpclient.connect-timeout", "1000");
        assertConfigDefault(properties, "spring.cloud.gateway.httpclient.response-timeout", "5s");
    }

    @Test
    void gatewayClassifiesShortReadRoutesWithShortTimeout() {
        Properties properties = loadGatewayProperties();
        Map<String, Integer> routeIndexes = routeIndexes(properties);

        assertRouteDefault(properties, routeIndexes, "user-auth-service", "response-timeout", "3000");
        assertRouteDefault(properties, routeIndexes, "ticket-hot-read-service", "response-timeout", "3000");
        assertRouteDefault(properties, routeIndexes, "search-service", "response-timeout", "3000");
        assertRouteDefault(properties, routeIndexes, "order-read-service", "response-timeout", "3000");
        assertRouteDefault(properties, routeIndexes, "notification-service", "response-timeout", "3000");

        assertRoutePredicate(properties, routeIndexes, "user-auth-service", "Path=/api/user/login,/api/user/send-code");
        assertRoutePredicate(properties, routeIndexes, "ticket-hot-read-service", "Path=/api/ticket/activities,/api/ticket/sessions/**");
        assertRoutePredicate(properties, routeIndexes, "search-service", "Path=/api/v1/search/**");
        assertRoutePredicate(properties, routeIndexes, "order-read-service", "Path=/api/order/user/**");
    }

    @Test
    void gatewayClassifiesLongRoutesWithLongOrStreamingTimeout() {
        Properties properties = loadGatewayProperties();
        Map<String, Integer> routeIndexes = routeIndexes(properties);

        assertRouteDefault(properties, routeIndexes, "payment-sync-service", "response-timeout", "15000");
        assertRouteDefault(properties, routeIndexes, "grab-service", "response-timeout", "15000");
        assertRouteDefault(properties, routeIndexes, "waitlist-service", "response-timeout", "15000");
        assertRouteDefault(properties, routeIndexes, "support-stream-service", "response-timeout", "-1");

        assertRoutePredicate(properties, routeIndexes, "payment-sync-service", "Path=/api/payment/alipay/sync/**");
        assertRoutePredicate(properties, routeIndexes, "support-stream-service", "Path=/api/user/support/conversations/{conversationId}/messages/stream");
    }

    @Test
    void prodSplitGatewayRoutesOverrideDefinesCompleteRouteList() {
        Properties properties = loadYamlProperties("application-prod-split.yml");
        Map<String, Integer> routeIndexes = routeIndexes(properties);

        assertRoutePredicate(properties, routeIndexes, "user-service", "Path=/api/user/**");
        assertRoutePredicate(properties, routeIndexes, "search-service", "Path=/api/v1/search/**");
        assertRoutePredicate(properties, routeIndexes, "ticket-service", "Path=/api/ticket/**");
        assertRoutePredicate(properties, routeIndexes, "order-service", "Path=/api/order/**");
        assertRoutePredicate(properties, routeIndexes, "payment-service", "Path=/api/payment/**");
        assertRoutePredicate(properties, routeIndexes, "notification-service", "Path=/api/notification/**");

        int waitlistIndex = requireRoute(routeIndexes, "waitlist-service");
        int grabIndex = requireRoute(routeIndexes, "grab-service");
        assertEquals("${GATEWAY_WAITLIST_SERVICE_URI}", properties.getProperty("spring.cloud.gateway.routes[" + waitlistIndex + "].uri"));
        assertEquals("${GATEWAY_GRAB_SERVICE_URI}", properties.getProperty("spring.cloud.gateway.routes[" + grabIndex + "].uri"));
    }

    private Properties loadGatewayProperties() {
        return loadYamlProperties("application.yml");
    }

    private Properties loadYamlProperties(String resourcePath) {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new ClassPathResource(resourcePath));
        Properties properties = factory.getObject();
        assertNotNull(properties);
        return properties;
    }

    private Map<String, Integer> routeIndexes(Properties properties) {
        Map<String, Integer> routeIndexes = new HashMap<String, Integer>();
        for (int i = 0; i < 50; i++) {
            String id = properties.getProperty("spring.cloud.gateway.routes[" + i + "].id");
            if (id != null) {
                routeIndexes.put(id, i);
            }
        }
        return routeIndexes;
    }

    private void assertRoutePredicate(
            Properties properties,
            Map<String, Integer> routeIndexes,
            String routeId,
            String expectedPredicate) {
        int index = requireRoute(routeIndexes, routeId);
        assertEquals(expectedPredicate, properties.getProperty("spring.cloud.gateway.routes[" + index + "].predicates[0]"));
    }

    private void assertRouteDefault(
            Properties properties,
            Map<String, Integer> routeIndexes,
            String routeId,
            String metadataKey,
            String expectedDefault) {
        int index = requireRoute(routeIndexes, routeId);
        assertConfigDefault(properties, "spring.cloud.gateway.routes[" + index + "].metadata." + metadataKey, expectedDefault);
    }

    private int requireRoute(Map<String, Integer> routeIndexes, String routeId) {
        assertTrue(routeIndexes.containsKey(routeId), "Missing gateway route: " + routeId);
        return routeIndexes.get(routeId);
    }

    private void assertConfigDefault(Properties properties, String key, String expectedDefault) {
        String value = properties.getProperty(key);
        assertNotNull(value, "Missing gateway config: " + key);
        assertEquals(expectedDefault, resolveDefault(value), key);
    }

    private String resolveDefault(String value) {
        if (value.startsWith("${") && value.endsWith("}") && value.contains(":")) {
            return value.substring(value.lastIndexOf(':') + 1, value.length() - 1);
        }
        return value;
    }
}
