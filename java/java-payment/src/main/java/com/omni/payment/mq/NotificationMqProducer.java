package com.omni.payment.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.MqPublishSupport;
import com.omni.common.mq.message.NotificationEventMessage;
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

    public void sendNotificationEvent(NotificationEventMessage message) {
        if (message == null) {
            return;
        }
        MqPublishSupport.afterCommitOrNow(() -> {
            try {
                log.info("Sending payment notification event via MQ: eventId={}, userId={}, eventType={}",
                        message.getEventId(), message.getUserId(), message.getEventType());
                rabbitTemplate.convertAndSend(MqConstants.NOTIFICATION_EXCHANGE, MqConstants.RK_NOTIFICATION_EVENT, message);
            } catch (RuntimeException e) {
                log.warn("退款通知事件发送失败 eventId={}, userId={}, eventType={}, message={}",
                        message.getEventId(), message.getUserId(), message.getEventType(), e.getMessage());
            }
        });
    }
}
