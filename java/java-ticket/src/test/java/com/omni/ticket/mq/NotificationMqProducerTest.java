package com.omni.ticket.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.common.mq.message.NotificationMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class NotificationMqProducerTest {

    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final NotificationMqProducer producer = new NotificationMqProducer(rabbitTemplate);

    @Test
    void defersPublishUntilTransactionCommit() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            producer.sendNotification(10L, null, "IN_APP", "通知内容");

            verifyNoInteractions(rabbitTemplate);
            TransactionSynchronizationManager.getSynchronizations().forEach(synchronization -> synchronization.afterCommit());
            ArgumentCaptor<NotificationMessage> captor = ArgumentCaptor.forClass(NotificationMessage.class);
            verify(rabbitTemplate).convertAndSend(
                    eq(MqConstants.NOTIFICATION_EXCHANGE),
                    eq(MqConstants.RK_NOTIFICATION_SEND),
                    captor.capture());
            assertEquals(10L, captor.getValue().getUserId());
            assertEquals("IN_APP", captor.getValue().getType());
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void sendsNotificationEventToEventRoutingKey() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("activity-cancelled:10:5001");
        message.setEventType("ACTIVITY_CANCELLED");
        message.setUserId(2004L);
        message.setOrderId(5001L);
        message.setContent("你购买的活动已取消，请查看订单详情。");

        producer.sendNotificationEvent(message);

        ArgumentCaptor<NotificationEventMessage> captor = ArgumentCaptor.forClass(NotificationEventMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(MqConstants.NOTIFICATION_EXCHANGE),
                eq(MqConstants.RK_NOTIFICATION_EVENT),
                captor.capture());
        assertEquals("activity-cancelled:10:5001", captor.getValue().getEventId());
        assertEquals("ACTIVITY_CANCELLED", captor.getValue().getEventType());
    }
}
