package com.omni.common.mq;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Queue;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MqConfigTest {

    private final MqConfig config = new MqConfig();

    @Test
    void notificationQueueDeadLettersToRetryQueue() {
        Queue queue = config.notificationSendQueue();

        assertEquals(MqConstants.NOTIFICATION_RETRY_EXCHANGE, queue.getArguments().get("x-dead-letter-exchange"));
        assertEquals(MqConstants.RK_NOTIFICATION_SEND_RETRY, queue.getArguments().get("x-dead-letter-routing-key"));
    }

    @Test
    void waitlistReleasedRetryQueueReturnsToMainExchangeAfterDelay() {
        Queue queue = config.waitlistReleasedRetryQueue();

        assertEquals(10000, queue.getArguments().get("x-message-ttl"));
        assertEquals(MqConstants.WAITLIST_EXCHANGE, queue.getArguments().get("x-dead-letter-exchange"));
        assertEquals(MqConstants.RK_WAITLIST_RELEASED, queue.getArguments().get("x-dead-letter-routing-key"));
    }

    @Test
    void waitlistOrderPaidDeadLetterQueueIsDurable() {
        Queue queue = config.waitlistOrderPaidDeadLetterQueue();

        assertEquals(MqConstants.Q_WAITLIST_ORDER_PAID_DLQ, queue.getName());
        assertEquals(true, queue.isDurable());
    }
}
