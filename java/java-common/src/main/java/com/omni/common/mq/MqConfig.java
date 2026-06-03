package com.omni.common.mq;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Exchange / Queue / Binding 声明 + JSON 消息转换器
 */
@Configuration
@ConditionalOnProperty(prefix = "omni.mq", name = "enabled", havingValue = "true")
public class MqConfig {

    private static final int RETRY_TTL_MILLIS = 10000;

    // ── JSON 序列化 ──

    @Bean
    public MessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    // ── Notification ──

    @Bean
    public TopicExchange notificationExchange() {
        return new TopicExchange(MqConstants.NOTIFICATION_EXCHANGE);
    }

    @Bean
    public TopicExchange notificationRetryExchange() {
        return new TopicExchange(MqConstants.NOTIFICATION_RETRY_EXCHANGE);
    }

    @Bean
    public TopicExchange notificationDeadLetterExchange() {
        return new TopicExchange(MqConstants.NOTIFICATION_DLX);
    }

    @Bean
    public Queue notificationSendQueue() {
        return QueueBuilder.durable(MqConstants.Q_NOTIFICATION_SEND)
                .withArgument("x-dead-letter-exchange", MqConstants.NOTIFICATION_RETRY_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_NOTIFICATION_SEND_RETRY)
                .build();
    }

    @Bean
    public Binding notificationSendBinding() {
        return BindingBuilder.bind(notificationSendQueue())
                .to(notificationExchange())
                .with(MqConstants.RK_NOTIFICATION_SEND);
    }

    @Bean
    public Queue notificationSendRetryQueue() {
        return QueueBuilder.durable(MqConstants.Q_NOTIFICATION_SEND_RETRY)
                .withArgument("x-message-ttl", RETRY_TTL_MILLIS)
                .withArgument("x-dead-letter-exchange", MqConstants.NOTIFICATION_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_NOTIFICATION_SEND)
                .build();
    }

    @Bean
    public Binding notificationSendRetryBinding() {
        return BindingBuilder.bind(notificationSendRetryQueue())
                .to(notificationRetryExchange())
                .with(MqConstants.RK_NOTIFICATION_SEND_RETRY);
    }

    @Bean
    public Queue notificationSendDeadLetterQueue() {
        return QueueBuilder.durable(MqConstants.Q_NOTIFICATION_SEND_DLQ).build();
    }

    @Bean
    public Binding notificationSendDeadLetterBinding() {
        return BindingBuilder.bind(notificationSendDeadLetterQueue())
                .to(notificationDeadLetterExchange())
                .with(MqConstants.RK_NOTIFICATION_SEND_DLQ);
    }

    // ── Waitlist ──

    @Bean
    public TopicExchange waitlistExchange() {
        return new TopicExchange(MqConstants.WAITLIST_EXCHANGE);
    }

    @Bean
    public TopicExchange waitlistRetryExchange() {
        return new TopicExchange(MqConstants.WAITLIST_RETRY_EXCHANGE);
    }

    @Bean
    public TopicExchange waitlistDeadLetterExchange() {
        return new TopicExchange(MqConstants.WAITLIST_DLX);
    }

    @Bean
    public Queue waitlistReleasedQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_RELEASED)
                .withArgument("x-dead-letter-exchange", MqConstants.WAITLIST_RETRY_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_WAITLIST_RELEASED_RETRY)
                .build();
    }

    @Bean
    public Binding waitlistReleasedBinding() {
        return BindingBuilder.bind(waitlistReleasedQueue())
                .to(waitlistExchange())
                .with(MqConstants.RK_WAITLIST_RELEASED);
    }

    @Bean
    public Queue waitlistReleasedRetryQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_RELEASED_RETRY)
                .withArgument("x-message-ttl", RETRY_TTL_MILLIS)
                .withArgument("x-dead-letter-exchange", MqConstants.WAITLIST_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_WAITLIST_RELEASED)
                .build();
    }

    @Bean
    public Binding waitlistReleasedRetryBinding() {
        return BindingBuilder.bind(waitlistReleasedRetryQueue())
                .to(waitlistRetryExchange())
                .with(MqConstants.RK_WAITLIST_RELEASED_RETRY);
    }

    @Bean
    public Queue waitlistReleasedDeadLetterQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_RELEASED_DLQ).build();
    }

    @Bean
    public Binding waitlistReleasedDeadLetterBinding() {
        return BindingBuilder.bind(waitlistReleasedDeadLetterQueue())
                .to(waitlistDeadLetterExchange())
                .with(MqConstants.RK_WAITLIST_RELEASED_DLQ);
    }

    @Bean
    public Queue waitlistOrderPaidQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_ORDER_PAID)
                .withArgument("x-dead-letter-exchange", MqConstants.WAITLIST_RETRY_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_WAITLIST_ORDER_PAID_RETRY)
                .build();
    }

    @Bean
    public Binding waitlistOrderPaidBinding() {
        return BindingBuilder.bind(waitlistOrderPaidQueue())
                .to(waitlistExchange())
                .with(MqConstants.RK_WAITLIST_ORDER_PAID);
    }

    @Bean
    public Queue waitlistOrderPaidRetryQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_ORDER_PAID_RETRY)
                .withArgument("x-message-ttl", RETRY_TTL_MILLIS)
                .withArgument("x-dead-letter-exchange", MqConstants.WAITLIST_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_WAITLIST_ORDER_PAID)
                .build();
    }

    @Bean
    public Binding waitlistOrderPaidRetryBinding() {
        return BindingBuilder.bind(waitlistOrderPaidRetryQueue())
                .to(waitlistRetryExchange())
                .with(MqConstants.RK_WAITLIST_ORDER_PAID_RETRY);
    }

    @Bean
    public Queue waitlistOrderPaidDeadLetterQueue() {
        return QueueBuilder.durable(MqConstants.Q_WAITLIST_ORDER_PAID_DLQ).build();
    }

    @Bean
    public Binding waitlistOrderPaidDeadLetterBinding() {
        return BindingBuilder.bind(waitlistOrderPaidDeadLetterQueue())
                .to(waitlistDeadLetterExchange())
                .with(MqConstants.RK_WAITLIST_ORDER_PAID_DLQ);
    }

    @Bean
    public TopicExchange searchIndexExchange() {
        return new TopicExchange(MqConstants.SEARCH_INDEX_EXCHANGE);
    }

    @Bean
    public TopicExchange searchIndexRetryExchange() {
        return new TopicExchange(MqConstants.SEARCH_INDEX_RETRY_EXCHANGE);
    }

    @Bean
    public TopicExchange searchIndexDeadLetterExchange() {
        return new TopicExchange(MqConstants.SEARCH_INDEX_DLX);
    }

    @Bean
    public Queue searchIndexQueue() {
        return QueueBuilder.durable(MqConstants.Q_SEARCH_INDEX)
                .withArgument("x-dead-letter-exchange", MqConstants.SEARCH_INDEX_RETRY_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_SEARCH_INDEX_REFRESH_RETRY)
                .build();
    }

    @Bean
    public Binding searchIndexBinding() {
        return BindingBuilder.bind(searchIndexQueue())
                .to(searchIndexExchange())
                .with(MqConstants.RK_SEARCH_INDEX_REFRESH);
    }

    @Bean
    public Queue searchIndexRetryQueue() {
        return QueueBuilder.durable(MqConstants.Q_SEARCH_INDEX_RETRY)
                .withArgument("x-message-ttl", RETRY_TTL_MILLIS)
                .withArgument("x-dead-letter-exchange", MqConstants.SEARCH_INDEX_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", MqConstants.RK_SEARCH_INDEX_REFRESH)
                .build();
    }

    @Bean
    public Binding searchIndexRetryBinding() {
        return BindingBuilder.bind(searchIndexRetryQueue())
                .to(searchIndexRetryExchange())
                .with(MqConstants.RK_SEARCH_INDEX_REFRESH_RETRY);
    }

    @Bean
    public Queue searchIndexDeadLetterQueue() {
        return QueueBuilder.durable(MqConstants.Q_SEARCH_INDEX_DLQ).build();
    }

    @Bean
    public Binding searchIndexDeadLetterBinding() {
        return BindingBuilder.bind(searchIndexDeadLetterQueue())
                .to(searchIndexDeadLetterExchange())
                .with(MqConstants.RK_SEARCH_INDEX_REFRESH_DLQ);
    }
}
