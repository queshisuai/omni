package com.omni.user.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.MqPublishSupport;
import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.common.mq.message.NotificationMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class NotificationMqProducer {

    private static final Logger log = LoggerFactory.getLogger(NotificationMqProducer.class);
    private final RabbitTemplate rabbitTemplate;

    public NotificationMqProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void sendNotification(Long userId, Long orderId, String type, String content) {
        NotificationMessage message = new NotificationMessage(userId, orderId, type, content);
        sendNotification(message);
    }

    public void sendNotification(NotificationMessage message) {
        if (message == null) {
            return;
        }
        MqPublishSupport.afterCommitOrNow(() -> {
            try {
                log.info("Sending notification message via MQ: userId={}, type={}", message.getUserId(), message.getType());
                rabbitTemplate.convertAndSend(MqConstants.NOTIFICATION_EXCHANGE, MqConstants.RK_NOTIFICATION_SEND, message);
            } catch (RuntimeException e) {
                log.warn("通知消息发送失败: userId={}, type={}, message={}",
                        message.getUserId(), message.getType(), e.getMessage());
            }
        });
    }

    public void sendNotificationEvent(NotificationEventMessage message) {
        if (message == null) {
            return;
        }
        MqPublishSupport.afterCommitOrNow(() -> {
            try {
                log.info("Sending notification event via MQ: eventId={}, userId={}, eventType={}",
                        message.getEventId(), message.getUserId(), message.getEventType());
                rabbitTemplate.convertAndSend(MqConstants.NOTIFICATION_EXCHANGE, MqConstants.RK_NOTIFICATION_EVENT, message);
            } catch (RuntimeException e) {
                log.warn("通知事件发送失败: eventId={}, userId={}, eventType={}, message={}",
                        message.getEventId(), message.getUserId(), message.getEventType(), e.getMessage());
            }
        });
    }
}
