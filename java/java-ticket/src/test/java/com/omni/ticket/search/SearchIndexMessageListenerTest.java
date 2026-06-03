package com.omni.ticket.search;

import com.omni.common.mq.message.SearchIndexMessage;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SearchIndexMessageListenerTest {

    private final ActivitySearchIndexService indexService = mock(ActivitySearchIndexService.class);
    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final SearchIndexMessageListener listener = new SearchIndexMessageListener(indexService, rabbitTemplate);

    @Test
    void listenerUpsertsActivityDocument() {
        listener.onSearchIndexRefresh(new SearchIndexMessage("activity", 10L, "UPSERT"), emptyRawMessage());

        verify(indexService).upsertActivity(10L);
    }

    @Test
    void listenerDeletesTourDocument() {
        listener.onSearchIndexRefresh(new SearchIndexMessage("tour", 31L, "DELETE"), emptyRawMessage());

        verify(indexService).deleteDocument("tour", 31L);
    }

    private Message emptyRawMessage() {
        return new Message(new byte[0], new MessageProperties());
    }
}
