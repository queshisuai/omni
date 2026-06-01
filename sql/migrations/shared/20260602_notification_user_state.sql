ALTER TABLE notification
    ADD COLUMN IF NOT EXISTS read_time TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS deleted_time TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS action_href VARCHAR(255),
    ADD COLUMN IF NOT EXISTS action_label VARCHAR(50),
    ADD COLUMN IF NOT EXISTS aggregate_key VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_notification_user_visible_time
    ON notification(user_id, deleted_time, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_notification_user_read_visible
    ON notification(user_id, read_time, deleted_time);

CREATE INDEX IF NOT EXISTS idx_notification_user_aggregate_visible
    ON notification(user_id, aggregate_key, deleted_time);
