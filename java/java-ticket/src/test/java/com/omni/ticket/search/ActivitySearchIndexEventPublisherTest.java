package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.ActivitySearchIndexMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class ActivitySearchIndexEventPublisherTest {

    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final ActivitySearchIndexEventPublisher publisher = new ActivitySearchIndexEventPublisher(rabbitTemplate);

    @Test
    void defersUpsertPublishUntilTransactionCommit() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            publisher.publishUpsert(900001L);

            verifyNoInteractions(rabbitTemplate);
            TransactionSynchronizationManager.getSynchronizations().forEach(synchronization -> synchronization.afterCommit());
            ArgumentCaptor<ActivitySearchIndexMessage> captor = ArgumentCaptor.forClass(ActivitySearchIndexMessage.class);
            verify(rabbitTemplate).convertAndSend(
                    eq(MqConstants.SEARCH_INDEX_EXCHANGE),
                    eq(MqConstants.RK_SEARCH_ACTIVITY_CHANGED),
                    captor.capture());
            assertEquals(900001L, captor.getValue().getActivityId());
            assertEquals(ActivitySearchIndexMessage.EVENT_TYPE_UPSERT, captor.getValue().getEventType());
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void publishFailureDoesNotEscapeBusinessFlow() {
        doThrow(new RuntimeException("rabbit down"))
                .when(rabbitTemplate).convertAndSend(any(String.class), any(String.class), any(ActivitySearchIndexMessage.class));

        assertDoesNotThrow(() -> publisher.publishDelete(900001L));
    }
}
