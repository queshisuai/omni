package com.omni.notification.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.NotificationMessage;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.service.NotificationService;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class NotificationMessageListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationMessageListener.class);
    private static final long MAX_RETRY_COUNT = 3L;

    private final NotificationService notificationService;
    private final RabbitTemplate rabbitTemplate;

    public NotificationMessageListener(NotificationService notificationService, RabbitTemplate rabbitTemplate) {
        this.notificationService = notificationService;
        this.rabbitTemplate = rabbitTemplate;
    }

    @RabbitListener(queues = MqConstants.Q_NOTIFICATION_SEND)
    public void onNotificationSend(NotificationMessage message, Message rawMessage) {
        log.info("Received notification message for userId: {}, orderId: {}, type: {}",
                message.getUserId(), message.getOrderId(), message.getType());
        try {
            InternalNotificationRequest request = new InternalNotificationRequest();
            request.setUserId(message.getUserId());
            request.setOrderId(message.getOrderId());
            request.setType(message.getType());
            request.setContent(message.getContent());
            request.setActionHref(message.getActionHref());
            request.setActionLabel(message.getActionLabel());
            request.setAggregateKey(message.getAggregateKey());

            notificationService.createInternalMessage(request);
        } catch (Exception e) {
            log.error("Failed to process notification message: {}", e.getMessage(), e);
            if (retryCount(rawMessage, MqConstants.Q_NOTIFICATION_SEND_RETRY) >= MAX_RETRY_COUNT) {
                rabbitTemplate.convertAndSend(MqConstants.NOTIFICATION_DLX, MqConstants.RK_NOTIFICATION_SEND_DLQ, message);
                log.warn("通知消息已进入死信队列: userId={}, type={}", message.getUserId(), message.getType());
                return;
            }
            throw new AmqpRejectAndDontRequeueException("通知消息处理失败，进入重试队列", e);
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
