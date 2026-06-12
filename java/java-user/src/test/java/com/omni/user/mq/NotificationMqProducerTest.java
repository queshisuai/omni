package com.omni.user.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.common.mq.message.NotificationMessage;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class NotificationMqProducerTest {

    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final NotificationMqProducer producer = new NotificationMqProducer(rabbitTemplate);

    @Test
    void defersPublishUntilTransactionCommit() {
        NotificationMessage message = new NotificationMessage(10L, null, "SUPPORT_REPLY", "客服消息");
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            producer.sendNotification(message);

            verifyNoInteractions(rabbitTemplate);
            TransactionSynchronizationManager.getSynchronizations().forEach(synchronization -> synchronization.afterCommit());
            verify(rabbitTemplate).convertAndSend(
                    MqConstants.NOTIFICATION_EXCHANGE,
                    MqConstants.RK_NOTIFICATION_SEND,
                    message);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void defersNotificationEventPublishUntilTransactionCommit() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("support-reply:99:501");
        message.setEventType("SUPPORT_REPLY");
        message.setUserId(10L);
        message.setContent("人工客服回复了你的咨询，请查看客服会话。");

        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            producer.sendNotificationEvent(message);

            verifyNoInteractions(rabbitTemplate);
            TransactionSynchronizationManager.getSynchronizations().forEach(synchronization -> synchronization.afterCommit());
            verify(rabbitTemplate).convertAndSend(
                    MqConstants.NOTIFICATION_EXCHANGE,
                    MqConstants.RK_NOTIFICATION_EVENT,
                    message);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
