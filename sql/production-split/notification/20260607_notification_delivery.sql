-- owner: java-notification

CREATE TABLE IF NOT EXISTS notification_delivery (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    user_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    activity_id BIGINT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    failure_reason VARCHAR(500) NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    provider_message_id VARCHAR(120) NULL,
    template_code VARCHAR(80) NULL,
    content_snapshot TEXT NULL,
    payload_json TEXT NULL,
    created_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_time TIMESTAMP NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_delivery_event_channel
    ON notification_delivery(event_id, channel);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_time
    ON notification_delivery(user_id, created_time DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_status_time
    ON notification_delivery(status, created_time DESC);
