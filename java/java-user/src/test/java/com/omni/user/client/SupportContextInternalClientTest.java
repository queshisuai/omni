package com.omni.user.client;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.openfeign.FeignClient;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupportContextInternalClientTest {

    @Test
    void ownerClientsExposeLocalUrlOverrides() {
        assertFeignClient(OrderSupportContextInternalClient.class,
                "orderSupportContextInternalClient", "${omni.order-service.url:}");
        assertFeignClient(PaymentSupportContextInternalClient.class,
                "paymentSupportContextInternalClient", "${omni.payment-service.url:}");
        assertFeignClient(NotificationSupportContextInternalClient.class,
                "notificationSupportContextInternalClient", "${omni.notification-service.url:}");
        assertFeignClient(GrabSupportContextInternalClient.class,
                "grabSupportContextInternalClient", "${omni.grab-service.url}");
    }

    private static void assertFeignClient(Class<?> clientType, String contextId, String url) {
        FeignClient annotation = clientType.getAnnotation(FeignClient.class);
        assertEquals(contextId, annotation.contextId());
        assertEquals(url, annotation.url());
    }
}
