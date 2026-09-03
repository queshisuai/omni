package com.omni.ticket.search;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.ActivitySearchIndexMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(prefix = "omni.search", name = "provider", havingValue = "elasticsearch")
public class ActivitySearchIndexEventListener {

    private static final Logger log = LoggerFactory.getLogger(ActivitySearchIndexEventListener.class);
    private static final long MAX_RETRY_COUNT = 3L;

    private final ActivitySearchIndexService indexService;
    private final RabbitTemplate rabbitTemplate;

    public ActivitySearchIndexEventListener(ActivitySearchIndexService indexService, RabbitTemplate rabbitTemplate) {
        this.indexService = indexService;
        this.rabbitTemplate = rabbitTemplate;
    }

    @RabbitListener(queues = MqConstants.Q_SEARCH_ACTIVITY_CHANGED)
    public void onActivityChanged(ActivitySearchIndexMessage message, Message rawMessage) {
        if (message == null || message.getActivityId() == null) {
            log.warn("活动搜索索引消息为空或缺少活动ID");
            return;
        }
        try {
            if (ActivitySearchIndexMessage.EVENT_TYPE_DELETE.equals(message.getEventType())) {
                indexService.deleteActivity(message.getActivityId());
            } else {
                indexService.upsertActivity(message.getActivityId());
            }
        } catch (Exception e) {
            log.error("活动搜索索引消息处理失败: activityId={}, eventType={}, message={}",
                    message.getActivityId(), message.getEventType(), e.getMessage(), e);
            if (retryCount(rawMessage, MqConstants.Q_SEARCH_ACTIVITY_CHANGED_RETRY) >= MAX_RETRY_COUNT) {
                rabbitTemplate.convertAndSend(MqConstants.SEARCH_INDEX_DLX, MqConstants.RK_SEARCH_ACTIVITY_CHANGED_DLQ, message);
                log.warn("活动搜索索引消息已进入死信队列: activityId={}, eventType={}",
                        message.getActivityId(), message.getEventType());
                return;
            }
            throw new AmqpRejectAndDontRequeueException("活动搜索索引消息处理失败，进入重试队列", e);
        }
    }

    private long retryCount(Message rawMessage, String retryQueue) {
        if (rawMessage == null || rawMessage.getMessageProperties() == null) {
            return 0L;
        }
        Object deaths = rawMessage.getMessageProperties().getHeaders().get("x-death");
        if (!(deaths instanceof List<?>)) {
            return 0L;
        }
        for (Object item : (List<?>) deaths) {
            if (item instanceof Map<?, ?>) {
                Map<?, ?> death = (Map<?, ?>) item;
                if (retryQueue.equals(String.valueOf(death.get("queue")))) {
                    Object count = death.get("count");
                    if (count instanceof Number) {
                        return ((Number) count).longValue();
                    }
                    try {
                        return Long.parseLong(String.valueOf(count));
                    } catch (NumberFormatException ignored) {
                        return 0L;
                    }
                }
            }
        }
        return 0L;
    }
}
