package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.MqPublishSupport;
import com.omni.common.mq.message.SearchIndexMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class SearchIndexMqProducer {

    private static final Logger log = LoggerFactory.getLogger(SearchIndexMqProducer.class);

    private final RabbitTemplate rabbitTemplate;

    public SearchIndexMqProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void refreshActivity(Long activityId) {
        publish(new SearchIndexMessage("activity", activityId, "UPSERT"));
    }

    public void deleteActivity(Long activityId) {
        publish(new SearchIndexMessage("activity", activityId, "DELETE"));
    }

    public void refreshTour(Long tourId) {
        publish(new SearchIndexMessage("tour", tourId, "UPSERT"));
    }

    public void deleteTour(Long tourId) {
        publish(new SearchIndexMessage("tour", tourId, "DELETE"));
    }

    private void publish(SearchIndexMessage message) {
        if (message == null || message.getItemId() == null) {
            return;
        }
        MqPublishSupport.afterCommitOrNow(() -> {
            try {
                rabbitTemplate.convertAndSend(
                        MqConstants.SEARCH_INDEX_EXCHANGE,
                        MqConstants.RK_SEARCH_INDEX_REFRESH,
                        message);
            } catch (RuntimeException e) {
                log.warn("搜索索引消息发送失败: itemType={}, itemId={}, action={}, message={}",
                        message.getItemType(), message.getItemId(), message.getAction(), e.getMessage());
            }
        });
    }
}
