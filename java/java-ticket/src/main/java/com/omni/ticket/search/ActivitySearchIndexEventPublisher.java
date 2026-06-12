package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.MqPublishSupport;
import com.omni.common.mq.message.ActivitySearchIndexMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class ActivitySearchIndexEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ActivitySearchIndexEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public ActivitySearchIndexEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishUpsert(Long activityId) {
        publish(ActivitySearchIndexMessage.upsert(activityId));
    }

    public void publishDelete(Long activityId) {
        publish(ActivitySearchIndexMessage.delete(activityId));
    }

    private void publish(ActivitySearchIndexMessage message) {
        MqPublishSupport.afterCommitOrNow(() -> {
            try {
                rabbitTemplate.convertAndSend(
                        MqConstants.SEARCH_INDEX_EXCHANGE,
                        MqConstants.RK_SEARCH_ACTIVITY_CHANGED,
                        message);
            } catch (RuntimeException e) {
                log.warn("活动搜索索引消息发送失败: activityId={}, eventType={}, message={}",
                        message.getActivityId(), message.getEventType(), e.getMessage());
            }
        });
    }
}
