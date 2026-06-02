package com.omni.order.client;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.openfeign.EnableFeignClients;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderFeignClientConfigurationTest {

    @Test
    void enablesOnlyOrderOwnedFeignClients() {
        EnableFeignClients annotation = OrderFeignClientConfiguration.class.getAnnotation(EnableFeignClients.class);

        assertEquals(3, annotation.clients().length);
        assertTrue(Arrays.asList(annotation.clients()).contains(PaymentInternalClient.class));
        assertTrue(Arrays.asList(annotation.clients()).contains(TicketSalesInternalClient.class));
        assertTrue(Arrays.asList(annotation.clients()).contains(UserInternalClient.class));
    }
}
