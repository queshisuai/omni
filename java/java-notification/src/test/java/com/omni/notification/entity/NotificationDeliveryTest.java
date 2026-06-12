package com.omni.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class NotificationDeliveryTest {

    @Test
    void mapsToNotificationDeliveryTableAndStoresDeliveryFields() {
        TableName tableName = NotificationDelivery.class.getAnnotation(TableName.class);
        NotificationDelivery delivery = new NotificationDelivery();
        LocalDateTime sentTime = LocalDateTime.parse("2026-06-07T01:45:00");

        delivery.setEventId("refund-approved:9001");
        delivery.setEventType("REFUND_APPROVED");
        delivery.setUserId(2004L);
        delivery.setOrderId(9001L);
        delivery.setActivityId(1001L);
        delivery.setChannel("IN_APP");
        delivery.setStatus("SENT");
        delivery.setRetryCount(1);
        delivery.setProviderMessageId("provider-1");
        delivery.setTemplateCode("refund-approved");
        delivery.setContentSnapshot("退款已通过。");
        delivery.setPayloadJson("{\"orderId\":9001}");
        delivery.setSentTime(sentTime);

        assertNotNull(tableName);
        assertEquals("notification_delivery", tableName.value());
        assertEquals("refund-approved:9001", delivery.getEventId());
        assertEquals("REFUND_APPROVED", delivery.getEventType());
        assertEquals(2004L, delivery.getUserId());
        assertEquals(9001L, delivery.getOrderId());
        assertEquals(1001L, delivery.getActivityId());
        assertEquals("IN_APP", delivery.getChannel());
        assertEquals("SENT", delivery.getStatus());
        assertEquals(1, delivery.getRetryCount());
        assertEquals("provider-1", delivery.getProviderMessageId());
        assertEquals("refund-approved", delivery.getTemplateCode());
        assertEquals("退款已通过。", delivery.getContentSnapshot());
        assertEquals("{\"orderId\":9001}", delivery.getPayloadJson());
        assertEquals(sentTime, delivery.getSentTime());
    }
}
