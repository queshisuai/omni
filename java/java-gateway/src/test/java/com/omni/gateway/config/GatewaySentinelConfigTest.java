package com.omni.gateway.config;

import com.alibaba.csp.sentinel.adapter.gateway.common.api.ApiDefinition;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.ApiPathPredicateItem;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.GatewayApiDefinitionManager;
import com.alibaba.csp.sentinel.adapter.gateway.common.rule.GatewayFlowRule;
import com.alibaba.csp.sentinel.adapter.gateway.common.rule.GatewayRuleManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.HttpMessageWriter;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.reactive.function.server.HandlerStrategies;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.reactive.result.view.ViewResolver;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewaySentinelConfigTest {

    @AfterEach
    void tearDown() {
        GatewayApiDefinitionManager.loadApiDefinitions(Set.of());
        GatewayRuleManager.loadRules(Set.of());
    }

    @Test
    void gatewayApiDefinitionsOnlyIncludeHotspotResources() throws Exception {
        GatewaySentinelConfig config = new GatewaySentinelConfig(20, 18, 50, 30, 40, 120);

        config.afterPropertiesSet();

        Map<String, ApiDefinition> definitions = GatewayApiDefinitionManager.getApiDefinitions()
                .stream()
                .collect(Collectors.toMap(ApiDefinition::getApiName, definition -> definition));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.GRAB_API));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.WAITLIST_API));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.ORDER_CREATE_API));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.PAYMENT_CRITICAL_API));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.USER_AUTH_API));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.TICKET_HOT_READ_API));
        assertFalse(definitions.containsKey("gateway-api-order"));
        assertFalse(definitions.containsKey("gateway-api-payment"));
        assertFalse(definitions.containsKey("gateway-api-ticket"));

        assertPatterns(definitions.get(GatewaySentinelConfig.WAITLIST_API), "/api/waitlist");
        assertPatterns(definitions.get(GatewaySentinelConfig.ORDER_CREATE_API), "/api/order/create", "/api/order/create-with-seats");
        assertPatterns(definitions.get(GatewaySentinelConfig.PAYMENT_CRITICAL_API), "/api/payment/alipay/sync", "/api/payment/alipay/notify");
        assertPatterns(definitions.get(GatewaySentinelConfig.USER_AUTH_API), "/api/user/login", "/api/user/send-code");
        assertPatterns(definitions.get(GatewaySentinelConfig.TICKET_HOT_READ_API),
                "/api/ticket/activities",
                "/api/ticket/sessions",
                "/api/ticket/sessions/",
                "/api/ticket/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats");
    }

    @Test
    void gatewayConfigPreservesUnrelatedApiDefinitionsAndFlowRules() throws Exception {
        ApiDefinition unrelatedDefinition = new ApiDefinition("unrelated-api")
                .setPredicateItems(Set.of(new ApiPathPredicateItem().setPattern("/unrelated")));
        GatewayApiDefinitionManager.loadApiDefinitions(Set.of(unrelatedDefinition));
        GatewayFlowRule unrelatedRule = new GatewayFlowRule("unrelated-api").setCount(7);
        GatewayRuleManager.loadRules(Set.of(unrelatedRule));
        GatewaySentinelConfig config = new GatewaySentinelConfig(20, 18, 50, 30, 40, 120);

        config.afterPropertiesSet();

        Map<String, ApiDefinition> definitions = GatewayApiDefinitionManager.getApiDefinitions()
                .stream()
                .collect(Collectors.toMap(ApiDefinition::getApiName, definition -> definition));
        assertTrue(definitions.containsKey("unrelated-api"));
        assertTrue(definitions.containsKey(GatewaySentinelConfig.GRAB_API));
        Map<String, GatewayFlowRule> rules = GatewayRuleManager.getRules()
                .stream()
                .collect(Collectors.toMap(GatewayFlowRule::getResource, rule -> rule));
        assertTrue(rules.containsKey("unrelated-api"));
        assertEquals(7, rules.get("unrelated-api").getCount());
        assertTrue(rules.containsKey(GatewaySentinelConfig.GRAB_API));
        assertTrue(rules.containsKey(GatewaySentinelConfig.WAITLIST_API));
        assertEquals(18, rules.get(GatewaySentinelConfig.WAITLIST_API).getCount());
    }

    @Test
    void gatewayBlockRequestHandlerReturnsTooManyRequestsJson() {
        GatewaySentinelConfig config = new GatewaySentinelConfig(20, 18, 50, 30, 40, 120);
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/grab/requests").build()
        );

        ServerResponse response = config.gatewayBlockRequestHandler()
                .handleRequest(exchange, null)
                .block();
        response.writeTo(exchange, responseContext()).block();

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, exchange.getResponse().getStatusCode());
        assertEquals(MediaType.parseMediaType("application/json;charset=UTF-8"), exchange.getResponse().getHeaders().getContentType());
        String body = exchange.getResponse().getBodyAsString().block();
        assertEquals("{\"code\":429,\"message\":\"系统繁忙，请稍后重试\",\"data\":null}", body);
        assertEquals(StandardCharsets.UTF_8, exchange.getResponse().getHeaders().getContentType().getCharset());
    }

    private void assertPatterns(ApiDefinition definition, String... expectedPatterns) {
        Set<String> actualPatterns = definition.getPredicateItems()
                .stream()
                .filter(ApiPathPredicateItem.class::isInstance)
                .map(ApiPathPredicateItem.class::cast)
                .map(ApiPathPredicateItem::getPattern)
                .collect(Collectors.toSet());
        for (String expectedPattern : expectedPatterns) {
            assertTrue(actualPatterns.contains(expectedPattern));
        }
    }

    private ServerResponse.Context responseContext() {
        HandlerStrategies strategies = HandlerStrategies.withDefaults();
        return new ServerResponse.Context() {
            @Override
            public List<HttpMessageWriter<?>> messageWriters() {
                return strategies.messageWriters();
            }

            @Override
            public List<ViewResolver> viewResolvers() {
                return strategies.viewResolvers();
            }
        };
    }
}
