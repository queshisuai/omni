package com.omni.order.mq;

import com.omni.common.mq.MqConstants;
import com.omni.common.mq.message.WaitlistOrderPaidMessage;
import com.omni.common.mq.message.WaitlistReleasedMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class WaitlistMqProducer {

    private static final Logger log = LoggerFactory.getLogger(WaitlistMqProducer.class);
    private final RabbitTemplate rabbitTemplate;

    public WaitlistMqProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void sendReleasedEvent(WaitlistReleasedMessage message) {
        log.info("Sending waitlist released event via MQ for eventKey: {}, sourceOrderId: {}",
                 message.getEventKey(), message.getSourceOrderId());
        rabbitTemplate.convertAndSend(MqConstants.WAITLIST_EXCHANGE, MqConstants.RK_WAITLIST_RELEASED, message);
    }

    public void sendOrderPaidEvent(Long orderId) {
        log.info("Sending waitlist order paid event via MQ for orderId: {}", orderId);
        WaitlistOrderPaidMessage message = new WaitlistOrderPaidMessage(orderId);
        rabbitTemplate.convertAndSend(MqConstants.WAITLIST_EXCHANGE, MqConstants.RK_WAITLIST_ORDER_PAID, message);
    }
}
