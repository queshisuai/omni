package com.omni.ticket.mq;

import com.omni.common.mq.MqConstants;
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
}
