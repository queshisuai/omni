package com.omni.payment.client;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.openfeign.FeignClient;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderClientTest {

    @Test
    void exposesLocalUrlOverride() {
        FeignClient annotation = OrderClient.class.getAnnotation(FeignClient.class);
        assertEquals("${omni.order-service.url:}", annotation.url());
    }
}
