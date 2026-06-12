package com.omni.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayDiagnosticsFilterTest {

    @Test
    void canBeCreatedBySpringContext() {
        new ApplicationContextRunner()
                .withUserConfiguration(GatewayDiagnosticsFilter.class)
                .withPropertyValues("omni.gateway.diagnostics.slow-threshold-ms=1200")
                .run(context -> {
                    assertTrue(context.isRunning());
                    assertNotNull(context.getBean(GatewayDiagnosticsFilter.class));
                });
    }

    @Test
    void generatesRequestIdWhenMissingAndPropagatesItToDownstreamAndResponse() {
        GatewayDiagnosticsFilter filter = new GatewayDiagnosticsFilter(800, fixedNanoTime());
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/ticket/activities").build()
        );
        exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR, route("ticket-service", "lb://java-ticket"));
        AtomicReference<ServerWebExchange> downstreamExchange = new AtomicReference<ServerWebExchange>();
        GatewayFilterChain chain = chainedExchange -> {
            downstreamExchange.set(chainedExchange);
            chainedExchange.getResponse().setStatusCode(HttpStatus.OK);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        String requestId = downstreamExchange.get().getRequest().getHeaders()
                .getFirst(GatewayDiagnosticsFilter.HEADER_X_REQUEST_ID);
        assertNotNull(requestId);
        assertTrue(requestId.matches("[0-9a-f]{32}"));
        assertEquals(requestId, exchange.getResponse().getHeaders()
                .getFirst(GatewayDiagnosticsFilter.HEADER_X_REQUEST_ID));
    }

    @Test
    void preservesIncomingRequestId() {
        GatewayDiagnosticsFilter filter = new GatewayDiagnosticsFilter(800, fixedNanoTime());
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/order/user/2004")
                        .header(GatewayDiagnosticsFilter.HEADER_X_REQUEST_ID, "client-trace-001")
                        .build()
        );
        exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR, route("order-service", "lb://java-order"));
        AtomicReference<ServerWebExchange> downstreamExchange = new AtomicReference<ServerWebExchange>();
        GatewayFilterChain chain = chainedExchange -> {
            downstreamExchange.set(chainedExchange);
            chainedExchange.getResponse().setStatusCode(HttpStatus.OK);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertEquals("client-trace-001", downstreamExchange.get().getRequest().getHeaders()
                .getFirst(GatewayDiagnosticsFilter.HEADER_X_REQUEST_ID));
        assertEquals("client-trace-001", exchange.getResponse().getHeaders()
                .getFirst(GatewayDiagnosticsFilter.HEADER_X_REQUEST_ID));
    }

    private Route route(String id, String uri) {
        return Route.async()
                .id(id)
                .uri(URI.create(uri))
                .predicate(exchange -> true)
                .build();
    }

    private java.util.function.LongSupplier fixedNanoTime() {
        return new java.util.function.LongSupplier() {
            private long current;

            @Override
            public long getAsLong() {
                current += 1_000_000L;
                return current;
            }
        };
    }
}
