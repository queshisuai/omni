package com.omni.notification.service;

import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.exception.BusinessException;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.entity.Notification;
import com.omni.notification.entity.NotificationDelivery;
import com.omni.notification.mapper.NotificationDeliveryMapper;
import com.omni.notification.sms.SmsSendRequest;
import com.omni.notification.sms.SmsSendResult;
import com.omni.notification.sms.SmsSender;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationEventServiceTest {

    private final NotificationDeliveryMapper deliveryMapper = mock(NotificationDeliveryMapper.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final SmsSender smsSender = mock(SmsSender.class);
    private final NotificationEventService service = new NotificationEventService(deliveryMapper, notificationService, smsSender);

    @Test
    void springContextCanCreateNotificationEventService() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(NotificationDeliveryMapper.class, () -> deliveryMapper);
            context.registerBean(NotificationService.class, () -> notificationService);
            context.registerBean(SmsSender.class, () -> smsSender);
            context.register(NotificationEventService.class);

            context.refresh();

            assertNotNull(context.getBean(NotificationEventService.class));
        }
    }

    @Test
    void processEventCreatesInAppNotificationAndSentDeliveryRecord() {
        NotificationEventMessage message = eventMessage();
        when(deliveryMapper.selectOne(any())).thenReturn(null);
        when(notificationService.createInternalMessage(any())).thenReturn(new Notification());

        service.processEvent(message);

        ArgumentCaptor<InternalNotificationRequest> requestCaptor = ArgumentCaptor.forClass(InternalNotificationRequest.class);
        verify(notificationService).createInternalMessage(requestCaptor.capture());
        InternalNotificationRequest request = requestCaptor.getValue();
        assertEquals(2004L, request.getUserId());
        assertEquals(9001L, request.getOrderId());
        assertEquals("SUPPORT_REPLY", request.getType());
        assertEquals("人工客服回复了你的咨询，请查看客服会话。", request.getContent());
        assertEquals("/help", request.getActionHref());
        assertEquals("查看客服会话", request.getActionLabel());
        assertEquals("SUPPORT_REPLY:99", request.getAggregateKey());

        ArgumentCaptor<NotificationDelivery> deliveryCaptor = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveryMapper).insert(deliveryCaptor.capture());
        NotificationDelivery delivery = deliveryCaptor.getValue();
        assertEquals("support-reply:99:1", delivery.getEventId());
        assertEquals("SUPPORT_REPLY", delivery.getEventType());
        assertEquals(2004L, delivery.getUserId());
        assertEquals(9001L, delivery.getOrderId());
        assertEquals(1001L, delivery.getActivityId());
        assertEquals("IN_APP", delivery.getChannel());
        assertEquals("SENT", delivery.getStatus());
        assertEquals(0, delivery.getRetryCount());
        assertEquals("support-reply", delivery.getTemplateCode());
        assertEquals("人工客服回复了你的咨询，请查看客服会话。", delivery.getContentSnapshot());
        assertEquals("{\"conversationId\":99}", delivery.getPayloadJson());
    }

    @Test
    void processEventDoesNotDuplicateExistingEventChannelDelivery() {
        NotificationEventMessage message = eventMessage();
        NotificationDelivery existing = new NotificationDelivery();
        existing.setEventId("support-reply:99:1");
        existing.setChannel("IN_APP");
        existing.setStatus("SENT");
        when(deliveryMapper.selectOne(any())).thenReturn(existing);

        service.processEvent(message);

        verify(notificationService, never()).createInternalMessage(any());
        verify(deliveryMapper, never()).insert(any());
    }

    @Test
    void processEventSkipsDisabledSmsAndKeepsInAppDelivery() {
        NotificationEventMessage message = eventMessage();
        message.setChannels(List.of("IN_APP", "SMS"));
        when(deliveryMapper.selectOne(any())).thenReturn(null);
        when(notificationService.createInternalMessage(any())).thenReturn(new Notification());
        when(smsSender.send(any())).thenReturn(new SmsSendResult("SKIPPED", null, "短信渠道未配置"));

        service.processEvent(message);

        verify(notificationService).createInternalMessage(any());

        ArgumentCaptor<SmsSendRequest> smsRequestCaptor = ArgumentCaptor.forClass(SmsSendRequest.class);
        verify(smsSender).send(smsRequestCaptor.capture());
        SmsSendRequest smsRequest = smsRequestCaptor.getValue();
        assertEquals("support-reply:99:1", smsRequest.getEventId());
        assertEquals("SUPPORT_REPLY", smsRequest.getEventType());
        assertEquals(2004L, smsRequest.getUserId());
        assertEquals(9001L, smsRequest.getOrderId());
        assertEquals(1001L, smsRequest.getActivityId());
        assertEquals("support-reply", smsRequest.getTemplateCode());
        assertEquals("人工客服回复了你的咨询，请查看客服会话。", smsRequest.getContent());

        ArgumentCaptor<NotificationDelivery> deliveryCaptor = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveryMapper, times(2)).insert(deliveryCaptor.capture());
        List<NotificationDelivery> deliveries = deliveryCaptor.getAllValues();

        NotificationDelivery inAppDelivery = deliveries.get(0);
        assertEquals("IN_APP", inAppDelivery.getChannel());
        assertEquals("SENT", inAppDelivery.getStatus());

        NotificationDelivery smsDelivery = deliveries.get(1);
        assertEquals("SMS", smsDelivery.getChannel());
        assertEquals("SKIPPED", smsDelivery.getStatus());
        assertEquals("短信渠道未配置", smsDelivery.getFailureReason());
    }

    @Test
    void processEventRejectsMissingRequiredFields() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("bad-event");
        message.setEventType("SUPPORT_REPLY");
        message.setUserId(2004L);

        assertThrows(BusinessException.class, () -> service.processEvent(message));
    }

    private static NotificationEventMessage eventMessage() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("support-reply:99:1");
        message.setEventType("SUPPORT_REPLY");
        message.setAggregateKey("SUPPORT_REPLY:99");
        message.setUserId(2004L);
        message.setOrderId(9001L);
        message.setActivityId(1001L);
        message.setTemplateCode("support-reply");
        message.setChannels(List.of("IN_APP"));
        message.setContent("人工客服回复了你的咨询，请查看客服会话。");
        message.setActionHref("/help");
        message.setActionLabel("查看客服会话");
        message.setPayload(Map.of("conversationId", 99));
        message.setOccurredAt(LocalDateTime.parse("2026-06-07T03:30:00"));
        return message;
    }
}
