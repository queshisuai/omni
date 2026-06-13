package com.omni.user.service;

import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PlatformInfrastructureHealthProbe {

    private static final int TIMEOUT_MS = 1500;

    private final Environment environment;
    private final EndpointChecker checker;

    @Autowired
    public PlatformInfrastructureHealthProbe(Environment environment) {
        this(environment, new SocketEndpointChecker());
    }

    PlatformInfrastructureHealthProbe(Environment environment, EndpointChecker checker) {
        this.environment = environment;
        this.checker = checker;
    }

    public PlatformOpsSummaryResponse.InfrastructureHealth probe() {
        PlatformOpsSummaryResponse.InfrastructureHealth health = new PlatformOpsSummaryResponse.InfrastructureHealth();
        health.setGeneratedAt(LocalDateTime.now());
        health.setItems(List.of(
                probeNacos(),
                probeTcp("redis", "Redis 缓存", redisHost(), redisPort(), "Redis 端口可达", "Redis 端口不可达"),
                probeTcp("rabbitmq", "RabbitMQ 消息队列", rabbitHost(), rabbitPort(), "RabbitMQ 端口可达", "RabbitMQ 端口不可达"),
                probeTcp("seata", "Seata 事务协调器", seataHost(), seataPort(), "Seata 端口可达", "Seata 端口不可达")
        ));
        return health;
    }

    private PlatformOpsSummaryResponse.InfrastructureHealthItem probeNacos() {
        String serverAddr = property(
                "spring.cloud.nacos.discovery.server-addr",
                "spring.cloud.nacos.config.server-addr",
                "NACOS_ADDR"
        );
        if (isBlank(serverAddr) || serverAddr.contains("${")) {
            return item("nacos", "Nacos 注册中心", "not_configured", "Nacos 探针未配置");
        }
        String url = toNacosUrl(serverAddr);
        boolean ok = checker.http(url, TIMEOUT_MS);
        return item("nacos", "Nacos 注册中心", ok ? "ok" : "degraded", ok ? "Nacos 控制台可达" : "Nacos 控制台不可达");
    }

    private PlatformOpsSummaryResponse.InfrastructureHealthItem probeTcp(String key,
                                                                         String label,
                                                                         String host,
                                                                         int port,
                                                                         String okMessage,
                                                                         String failMessage) {
        if (isBlank(host) || host.contains("${") || port <= 0) {
            return item(key, label, "not_configured", label + "探针未配置");
        }
        boolean ok = checker.tcp(host, port, TIMEOUT_MS);
        return item(key, label, ok ? "ok" : "degraded", ok ? okMessage : failMessage);
    }

    private PlatformOpsSummaryResponse.InfrastructureHealthItem item(String key, String label, String status, String message) {
        return new PlatformOpsSummaryResponse.InfrastructureHealthItem(key, label, status, message);
    }

    private String redisHost() {
        return propertyOrDefault("spring.redis.host", "REDIS_HOST", "localhost");
    }

    private int redisPort() {
        return intPropertyOrDefault(6379, "spring.redis.port", "REDIS_PORT");
    }

    private String rabbitHost() {
        return propertyOrDefault("spring.rabbitmq.host", "RABBITMQ_HOST", "localhost");
    }

    private int rabbitPort() {
        return intPropertyOrDefault(5672, "spring.rabbitmq.port", "RABBITMQ_PORT");
    }

    private String seataHost() {
        return propertyOrDefault("seata.server.host", "SEATA_ADVERTISE_HOST", "localhost");
    }

    private int seataPort() {
        return intPropertyOrDefault(8091, "seata.server.port", "SEATA_ADVERTISE_PORT");
    }

    private String propertyOrDefault(String key, String envKey, String fallback) {
        String value = property(key, envKey);
        return isBlank(value) ? fallback : value;
    }

    private int intPropertyOrDefault(int fallback, String... keys) {
        String value = property(keys);
        if (isBlank(value)) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String property(String... keys) {
        for (String key : keys) {
            String value = environment.getProperty(key);
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private String toNacosUrl(String serverAddr) {
        String normalized = serverAddr.trim();
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return normalized.endsWith("/") ? normalized + "nacos/" : normalized + "/nacos/";
        }
        return "http://" + normalized + "/nacos/";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    interface EndpointChecker {
        boolean tcp(String host, int port, int timeoutMs);
        boolean http(String url, int timeoutMs);
    }

    private static class SocketEndpointChecker implements EndpointChecker {
        @Override
        public boolean tcp(String host, int port, int timeoutMs) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), timeoutMs);
                return true;
            } catch (IOException ignored) {
                return false;
            }
        }

        @Override
        public boolean http(String url, int timeoutMs) {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(timeoutMs);
                connection.setReadTimeout(timeoutMs);
                connection.setRequestMethod("GET");
                int status = connection.getResponseCode();
                return status >= 200 && status < 400;
            } catch (IOException ignored) {
                return false;
            }
        }
    }
}
