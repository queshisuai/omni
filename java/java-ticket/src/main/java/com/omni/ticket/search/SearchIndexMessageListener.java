package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.SearchIndexMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SearchIndexMessageListener {

    private static final Logger log = LoggerFactory.getLogger(SearchIndexMessageListener.class);

    private static final String ITEM_ACTIVITY = "activity";
    private static final String ITEM_TOUR = "tour";
    private static final String ACTION_DELETE = "DELETE";
    private static final String ACTION_UPSERT = "UPSERT";

    private final ActivitySearchIndexService indexService;
    private final RabbitTemplate rabbitTemplate;

    public SearchIndexMessageListener(ActivitySearchIndexService indexService, RabbitTemplate rabbitTemplate) {
        this.indexService = indexService;
        this.rabbitTemplate = rabbitTemplate;
    }

    @RabbitListener(queues = MqConstants.Q_SEARCH_INDEX)
    public void onSearchIndexRefresh(SearchIndexMessage message, Message rawMessage) {
        if (!isValid(message)) {
            sendDeadLetter(message);
            return;
        }
        try {
            handle(message);
        } catch (RuntimeException e) {
            log.warn("搜索索引消息处理失败，已进入重试队列: itemType={}, itemId={}, action={}, message={}",
                    message.getItemType(), message.getItemId(), message.getAction(), e.getMessage());
            rabbitTemplate.convertAndSend(
                    MqConstants.SEARCH_INDEX_RETRY_EXCHANGE,
                    MqConstants.RK_SEARCH_INDEX_REFRESH_RETRY,
                    message);
        }
    }

    private void handle(SearchIndexMessage message) {
        if (ACTION_DELETE.equals(message.getAction())) {
            indexService.deleteDocument(message.getItemType(), message.getItemId());
            return;
        }
        if (ITEM_TOUR.equals(message.getItemType())) {
            indexService.upsertTour(message.getItemId());
            return;
        }
        indexService.upsertActivity(message.getItemId());
    }

    private boolean isValid(SearchIndexMessage message) {
        return message != null
                && (ITEM_ACTIVITY.equals(message.getItemType()) || ITEM_TOUR.equals(message.getItemType()))
                && message.getItemId() != null
                && StringUtils.hasText(message.getAction())
                && (ACTION_UPSERT.equals(message.getAction()) || ACTION_DELETE.equals(message.getAction()));
    }

    private void sendDeadLetter(SearchIndexMessage message) {
        log.warn("搜索索引消息无效，已进入死信队列");
        rabbitTemplate.convertAndSend(
                MqConstants.SEARCH_INDEX_DLX,
                MqConstants.RK_SEARCH_INDEX_REFRESH_DLQ,
                message);
    }
}
