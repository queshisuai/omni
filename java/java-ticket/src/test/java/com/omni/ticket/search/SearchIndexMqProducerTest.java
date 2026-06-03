package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.SearchIndexMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class SearchIndexMqProducerTest {

    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final SearchIndexMqProducer producer = new SearchIndexMqProducer(rabbitTemplate);

    @Test
    void defersActivityRefreshUntilTransactionCommit() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            producer.refreshActivity(10L);

            verifyNoInteractions(rabbitTemplate);
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(synchronization -> synchronization.afterCommit());

            ArgumentCaptor<SearchIndexMessage> captor = ArgumentCaptor.forClass(SearchIndexMessage.class);
            verify(rabbitTemplate).convertAndSend(
                    eq(MqConstants.SEARCH_INDEX_EXCHANGE),
                    eq(MqConstants.RK_SEARCH_INDEX_REFRESH),
                    captor.capture());
            assertEquals("activity", captor.getValue().getItemType());
            assertEquals(10L, captor.getValue().getItemId());
            assertEquals("UPSERT", captor.getValue().getAction());
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void deleteTourPublishesDeleteAction() {
        producer.deleteTour(31L);

        ArgumentCaptor<SearchIndexMessage> captor = ArgumentCaptor.forClass(SearchIndexMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(MqConstants.SEARCH_INDEX_EXCHANGE),
                eq(MqConstants.RK_SEARCH_INDEX_REFRESH),
                captor.capture());
        assertEquals("tour", captor.getValue().getItemType());
        assertEquals(31L, captor.getValue().getItemId());
        assertEquals("DELETE", captor.getValue().getAction());
    }
}
