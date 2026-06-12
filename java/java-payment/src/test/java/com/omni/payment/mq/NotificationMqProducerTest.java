package com.omni.payment.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.NotificationEventMessage;
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
    void defersNotificationEventPublishUntilTransactionCommit() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("refund-approved:500:RF-001");
        message.setEventType("REFUND_APPROVED");
        message.setUserId(2004L);
        message.setOrderId(10L);
        message.setContent("退款审核已通过");

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
