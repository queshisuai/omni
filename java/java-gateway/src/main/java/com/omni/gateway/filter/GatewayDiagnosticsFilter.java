package com.omni.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;

@Component
public class GatewayDiagnosticsFilter implements GlobalFilter, Ordered {

    public static final String HEADER_X_REQUEST_ID = "X-Request-Id";

    private static final Logger log = LoggerFactory.getLogger(GatewayDiagnosticsFilter.class);
    private static final int ORDER = Ordered.HIGHEST_PRECEDENCE;

    private final long slowThresholdMs;
    private final LongSupplier nanoTimeSupplier;

    @Autowired
    public GatewayDiagnosticsFilter(
            @Value("${omni.gateway.diagnostics.slow-threshold-ms:800}") long slowThresholdMs) {
        this(slowThresholdMs, System::nanoTime);
    }

    GatewayDiagnosticsFilter(long slowThresholdMs, LongSupplier nanoTimeSupplier) {
        this.slowThresholdMs = slowThresholdMs;
        this.nanoTimeSupplier = nanoTimeSupplier;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startedAtNanos = nanoTimeSupplier.getAsLong();
        String requestId = resolveRequestId(exchange);
        ServerWebExchange tracedExchange = withRequestId(exchange, requestId);
        tracedExchange.getResponse().getHeaders().set(HEADER_X_REQUEST_ID, requestId);

        AtomicReference<Throwable> errorRef = new AtomicReference<Throwable>();
        return chain.filter(tracedExchange)
                .doOnError(errorRef::set)
                .doFinally(signalType -> logCompletion(tracedExchange, requestId, startedAtNanos, signalType, errorRef.get()));
    }

    @Override
    public int getOrder() {
        return ORDER;
    }

    private String resolveRequestId(ServerWebExchange exchange) {
        String requestId = exchange.getRequest().getHeaders().getFirst(HEADER_X_REQUEST_ID);
        if (requestId == null || requestId.trim().isEmpty()) {
            return UUID.randomUUID().toString().replace("-", "");
        }
        return requestId;
    }

    private ServerWebExchange withRequestId(ServerWebExchange exchange, String requestId) {
        ServerHttpRequest request = exchange.getRequest()
                .mutate()
                .headers(headers -> headers.set(HEADER_X_REQUEST_ID, requestId))
                .build();
        return exchange.mutate().request(request).build();
    }

    private void logCompletion(
            ServerWebExchange exchange,
            String requestId,
            long startedAtNanos,
            SignalType signalType,
            Throwable error) {
        long durationMs = Math.max(0, (nanoTimeSupplier.getAsLong() - startedAtNanos) / 1_000_000L);
        Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
        String routeId = route == null ? "UNKNOWN" : route.getId();
        URI targetUri = route == null ? null : route.getUri();
        HttpStatus status = exchange.getResponse().getStatusCode();
        String statusCode = status == null ? "UNKNOWN" : String.valueOf(status.value());
        String errorName = error == null ? "" : error.getClass().getSimpleName();

        if (durationMs >= slowThresholdMs || error != null) {
            log.warn("网关请求完成 traceId={} method={} path={} routeId={} targetUri={} status={} durationMs={} signal={} error={}",
                    requestId,
                    exchange.getRequest().getMethodValue(),
                    exchange.getRequest().getURI().getRawPath(),
                    routeId,
                    targetUri,
                    statusCode,
                    durationMs,
                    signalType,
                    errorName);
            return;
        }

        log.info("网关请求完成 traceId={} method={} path={} routeId={} targetUri={} status={} durationMs={} signal={}",
                requestId,
                exchange.getRequest().getMethodValue(),
                exchange.getRequest().getURI().getRawPath(),
                routeId,
                targetUri,
                statusCode,
                durationMs,
                signalType);
    }
}
