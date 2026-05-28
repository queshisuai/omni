package com.omni.gateway.config;

import com.alibaba.csp.sentinel.adapter.gateway.common.SentinelGatewayConstants;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.ApiDefinition;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.ApiPathPredicateItem;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.ApiPredicateItem;
import com.alibaba.csp.sentinel.adapter.gateway.common.api.GatewayApiDefinitionManager;
import com.alibaba.csp.sentinel.adapter.gateway.common.rule.GatewayFlowRule;
import com.alibaba.csp.sentinel.adapter.gateway.common.rule.GatewayRuleManager;
import com.alibaba.csp.sentinel.adapter.gateway.sc.callback.BlockRequestHandler;
import com.alibaba.csp.sentinel.adapter.gateway.sc.callback.GatewayCallbackManager;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class GatewaySentinelConfig implements InitializingBean {

    public static final String GRAB_API = "gateway-api-grab";
    public static final String ORDER_CREATE_API = "gateway-api-order-create";
    public static final String PAYMENT_CRITICAL_API = "gateway-api-payment-critical";
    public static final String USER_AUTH_API = "gateway-api-user-auth";
    public static final String TICKET_HOT_READ_API = "gateway-api-ticket-hot-read";

    private static final String BLOCK_RESPONSE_BODY = "{\"code\":429,\"message\":\"系统繁忙，请稍后重试\",\"data\":null}";

    private final double grabQps;
    private final double orderCreateQps;
    private final double paymentCriticalQps;
    private final double userAuthQps;
    private final double ticketHotReadQps;

    public GatewaySentinelConfig(
            @Value("${omni.gateway.sentinel.qps.grab:20}") double grabQps,
            @Value("${omni.gateway.sentinel.qps.order-create:50}") double orderCreateQps,
            @Value("${omni.gateway.sentinel.qps.payment-critical:30}") double paymentCriticalQps,
            @Value("${omni.gateway.sentinel.qps.user-auth:40}") double userAuthQps,
            @Value("${omni.gateway.sentinel.qps.ticket-hot-read:120}") double ticketHotReadQps) {
        this.grabQps = grabQps;
        this.orderCreateQps = orderCreateQps;
        this.paymentCriticalQps = paymentCriticalQps;
        this.userAuthQps = userAuthQps;
        this.ticketHotReadQps = ticketHotReadQps;
    }

    @Override
    public void afterPropertiesSet() {
        loadApiDefinitions(buildApiDefinitions());
        loadGatewayFlowRules(buildGatewayFlowRules());
        GatewayCallbackManager.setBlockHandler(gatewayBlockRequestHandler());
    }

    public BlockRequestHandler gatewayBlockRequestHandler() {
        return (exchange, throwable) -> writeBlockResponse(exchange);
    }

    private Mono<ServerResponse> writeBlockResponse(ServerWebExchange exchange) {
        return ServerResponse.status(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.parseMediaType("application/json;charset=UTF-8"))
                .body(BodyInserters.fromValue(BLOCK_RESPONSE_BODY));
    }

    private Set<ApiDefinition> buildApiDefinitions() {
        Map<String, Set<ApiPredicateItem>> definitions = new HashMap<String, Set<ApiPredicateItem>>();
        addApiPath(definitions, GRAB_API, "/api/grab");
        addApiPath(definitions, ORDER_CREATE_API, "/api/order/create");
        addApiPath(definitions, ORDER_CREATE_API, "/api/order/create-with-seats");
        addApiPath(definitions, PAYMENT_CRITICAL_API, "/api/payment/alipay/sync");
        addApiPath(definitions, PAYMENT_CRITICAL_API, "/api/payment/alipay/notify");
        addApiPath(definitions, USER_AUTH_API, "/api/user/login");
        addApiPath(definitions, USER_AUTH_API, "/api/user/send-code");
        addApiPath(definitions, TICKET_HOT_READ_API, "/api/ticket/activities");
        addApiPath(definitions, TICKET_HOT_READ_API, "/api/ticket/sessions");
        addApiPath(definitions, TICKET_HOT_READ_API, "/api/ticket/sessions/");
        addApiPath(definitions, TICKET_HOT_READ_API, "/api/ticket/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats");

        Set<ApiDefinition> apiDefinitions = new HashSet<ApiDefinition>();
        for (Map.Entry<String, Set<ApiPredicateItem>> entry : definitions.entrySet()) {
            apiDefinitions.add(new ApiDefinition(entry.getKey()).setPredicateItems(entry.getValue()));
        }
        return apiDefinitions;
    }

    private void addApiPath(Map<String, Set<ApiPredicateItem>> definitions, String apiName, String pathPrefix) {
        Set<ApiPredicateItem> predicateItems = definitions.computeIfAbsent(apiName, ignored -> new HashSet<ApiPredicateItem>());
        predicateItems.add(new ApiPathPredicateItem()
                .setPattern(pathPrefix)
                .setMatchStrategy(SentinelGatewayConstants.URL_MATCH_STRATEGY_PREFIX));
    }

    private void loadApiDefinitions(Set<ApiDefinition> ownedDefinitions) {
        Set<String> ownedApiNames = ownedDefinitions.stream()
                .map(ApiDefinition::getApiName)
                .collect(Collectors.toSet());
        Set<ApiDefinition> mergedDefinitions = GatewayApiDefinitionManager.getApiDefinitions().stream()
                .filter(definition -> !ownedApiNames.contains(definition.getApiName()))
                .collect(Collectors.toCollection(HashSet::new));
        mergedDefinitions.addAll(ownedDefinitions);
        GatewayApiDefinitionManager.loadApiDefinitions(mergedDefinitions);
    }

    private Set<GatewayFlowRule> buildGatewayFlowRules() {
        Set<GatewayFlowRule> rules = new HashSet<GatewayFlowRule>();
        rules.add(gatewayFlowRule(GRAB_API, grabQps));
        rules.add(gatewayFlowRule(ORDER_CREATE_API, orderCreateQps));
        rules.add(gatewayFlowRule(PAYMENT_CRITICAL_API, paymentCriticalQps));
        rules.add(gatewayFlowRule(USER_AUTH_API, userAuthQps));
        rules.add(gatewayFlowRule(TICKET_HOT_READ_API, ticketHotReadQps));
        return rules;
    }

    private void loadGatewayFlowRules(Set<GatewayFlowRule> ownedRules) {
        Set<String> ownedResources = ownedRules.stream()
                .map(GatewayFlowRule::getResource)
                .collect(Collectors.toSet());
        Set<GatewayFlowRule> mergedRules = GatewayRuleManager.getRules().stream()
                .filter(rule -> !ownedResources.contains(rule.getResource()))
                .collect(Collectors.toCollection(HashSet::new));
        mergedRules.addAll(ownedRules);
        GatewayRuleManager.loadRules(mergedRules);
    }

    private GatewayFlowRule gatewayFlowRule(String apiName, double qps) {
        return new GatewayFlowRule(apiName)
                .setResourceMode(SentinelGatewayConstants.RESOURCE_MODE_CUSTOM_API_NAME)
                .setCount(qps)
                .setIntervalSec(1);
    }
}
