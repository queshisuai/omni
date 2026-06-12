package com.omni.common.mq;

/**
 * RabbitMQ 常量定义 — Exchange / Queue / Routing Key
 */
public final class MqConstants {

    // ── Exchanges ──
    public static final String NOTIFICATION_EXCHANGE = "omni.notification";
    public static final String NOTIFICATION_RETRY_EXCHANGE = "omni.notification.retry";
    public static final String NOTIFICATION_DLX = "omni.notification.dlx";
    public static final String WAITLIST_EXCHANGE = "omni.waitlist";
    public static final String WAITLIST_RETRY_EXCHANGE = "omni.waitlist.retry";
    public static final String WAITLIST_DLX = "omni.waitlist.dlx";
    public static final String SEARCH_INDEX_EXCHANGE = "omni.search-index";
    public static final String SEARCH_INDEX_RETRY_EXCHANGE = "omni.search-index.retry";
    public static final String SEARCH_INDEX_DLX = "omni.search-index.dlx";

    // ── Routing Keys ──
    public static final String RK_NOTIFICATION_SEND = "notification.send";
    public static final String RK_NOTIFICATION_SEND_RETRY = "notification.send.retry";
    public static final String RK_NOTIFICATION_SEND_DLQ = "notification.send.dlq";
    public static final String RK_NOTIFICATION_EVENT = "notification.event";
    public static final String RK_NOTIFICATION_EVENT_RETRY = "notification.event.retry";
    public static final String RK_NOTIFICATION_EVENT_DLQ = "notification.event.dlq";
    public static final String RK_WAITLIST_RELEASED = "waitlist.released";
    public static final String RK_WAITLIST_RELEASED_RETRY = "waitlist.released.retry";
    public static final String RK_WAITLIST_RELEASED_DLQ = "waitlist.released.dlq";
    public static final String RK_WAITLIST_ORDER_PAID = "waitlist.order-paid";
    public static final String RK_WAITLIST_ORDER_PAID_RETRY = "waitlist.order-paid.retry";
    public static final String RK_WAITLIST_ORDER_PAID_DLQ = "waitlist.order-paid.dlq";
    public static final String RK_SEARCH_ACTIVITY_CHANGED = "search.activity.changed";
    public static final String RK_SEARCH_ACTIVITY_CHANGED_RETRY = "search.activity.changed.retry";
    public static final String RK_SEARCH_ACTIVITY_CHANGED_DLQ = "search.activity.changed.dlq";

    // ── Queues ──
    public static final String Q_NOTIFICATION_SEND = "notification.send.queue";
    public static final String Q_NOTIFICATION_SEND_RETRY = "notification.send.retry.queue";
    public static final String Q_NOTIFICATION_SEND_DLQ = "notification.send.dlq";
    public static final String Q_NOTIFICATION_EVENT = "notification.event.queue";
    public static final String Q_NOTIFICATION_EVENT_RETRY = "notification.event.retry.queue";
    public static final String Q_NOTIFICATION_EVENT_DLQ = "notification.event.dlq";
    public static final String Q_WAITLIST_RELEASED = "waitlist.released.queue";
    public static final String Q_WAITLIST_RELEASED_RETRY = "waitlist.released.retry.queue";
    public static final String Q_WAITLIST_RELEASED_DLQ = "waitlist.released.dlq";
    public static final String Q_WAITLIST_ORDER_PAID = "waitlist.order-paid.queue";
    public static final String Q_WAITLIST_ORDER_PAID_RETRY = "waitlist.order-paid.retry.queue";
    public static final String Q_WAITLIST_ORDER_PAID_DLQ = "waitlist.order-paid.dlq";
    public static final String Q_SEARCH_ACTIVITY_CHANGED = "search.activity.changed.queue";
    public static final String Q_SEARCH_ACTIVITY_CHANGED_RETRY = "search.activity.changed.retry.queue";
    public static final String Q_SEARCH_ACTIVITY_CHANGED_DLQ = "search.activity.changed.dlq";

    private MqConstants() {}
}
