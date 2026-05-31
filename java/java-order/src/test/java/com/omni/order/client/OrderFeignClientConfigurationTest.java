package com.omni.order.client;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.openfeign.EnableFeignClients;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderFeignClientConfigurationTest {

    @Test
    void enablesWaitlistInternalClient() {
        EnableFeignClients annotation = OrderFeignClientConfiguration.class.getAnnotation(EnableFeignClients.class);

        assertTrue(Arrays.asList(annotation.clients()).contains(WaitlistInternalClient.class));
    }
}
