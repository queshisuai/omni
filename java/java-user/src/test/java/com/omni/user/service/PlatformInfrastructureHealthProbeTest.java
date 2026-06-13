package com.omni.user.service;

import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlatformInfrastructureHealthProbeTest {

    @Test
    void springCreatesProbeBeanWithEnvironmentConstructor() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.cloud.nacos.discovery.server-addr", "localhost:8848");

        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(environment);
            context.register(PlatformInfrastructureHealthProbe.class);
            context.refresh();

            assertEquals(
                    PlatformInfrastructureHealthProbe.class,
                    context.getBean(PlatformInfrastructureHealthProbe.class).getClass()
            );
        }
    }

    @Test
    void probesConfiguredInfrastructureWithChineseLabels() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.cloud.nacos.discovery.server-addr", "nacos.local:8848")
                .withProperty("spring.rabbitmq.host", "rabbitmq.local")
                .withProperty("spring.rabbitmq.port", "5672")
                .withProperty("REDIS_HOST", "redis.local")
                .withProperty("REDIS_PORT", "6379")
                .withProperty("SEATA_ADVERTISE_HOST", "seata.local")
                .withProperty("SEATA_ADVERTISE_PORT", "8091");
        PlatformInfrastructureHealthProbe probe = new PlatformInfrastructureHealthProbe(
                environment,
                new PlatformInfrastructureHealthProbe.EndpointChecker() {
                    @Override
                    public boolean tcp(String host, int port, int timeoutMs) {
                        return !("seata.local".equals(host) && port == 8091);
                    }

                    @Override
                    public boolean http(String url, int timeoutMs) {
                        return url.equals("http://nacos.local:8848/nacos/");
                    }
                }
        );

        PlatformOpsSummaryResponse.InfrastructureHealth health = probe.probe();

        assertEquals(4, health.getItems().size());
        assertHealth(health.getItems(), "nacos", "Nacos 注册中心", "ok", "Nacos 控制台可达");
        assertHealth(health.getItems(), "redis", "Redis 缓存", "ok", "Redis 端口可达");
        assertHealth(health.getItems(), "rabbitmq", "RabbitMQ 消息队列", "ok", "RabbitMQ 端口可达");
        assertHealth(health.getItems(), "seata", "Seata 事务协调器", "degraded", "Seata 端口不可达");
    }

    @Test
    void reportsNacosAsNotConfiguredWhenServerAddressIsMissing() {
        MockEnvironment environment = new MockEnvironment();
        PlatformInfrastructureHealthProbe probe = new PlatformInfrastructureHealthProbe(
                environment,
                new PlatformInfrastructureHealthProbe.EndpointChecker() {
                    @Override
                    public boolean tcp(String host, int port, int timeoutMs) {
                        return true;
                    }

                    @Override
                    public boolean http(String url, int timeoutMs) {
                        return true;
                    }
                }
        );

        PlatformOpsSummaryResponse.InfrastructureHealth health = probe.probe();

        assertHealth(health.getItems(), "nacos", "Nacos 注册中心", "not_configured", "Nacos 探针未配置");
    }

    private void assertHealth(List<PlatformOpsSummaryResponse.InfrastructureHealthItem> items,
                              String key,
                              String label,
                              String status,
                              String message) {
        PlatformOpsSummaryResponse.InfrastructureHealthItem item = items.stream()
                .filter(candidate -> key.equals(candidate.getKey()))
                .findFirst()
                .orElseThrow();
        assertEquals(label, item.getLabel());
        assertEquals(status, item.getStatus());
        assertEquals(message, item.getMessage());
    }
}
