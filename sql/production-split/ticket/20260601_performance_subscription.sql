-- owner: java-ticket
-- P0 开售前想看/提醒/关注/日历订阅

CREATE TABLE IF NOT EXISTS performance_subscription (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id BIGINT,
    target_value VARCHAR(120),
    target_name VARCHAR(200),
    activity_id BIGINT REFERENCES activity(id),
    artist_id BIGINT REFERENCES artist(id),
    city VARCHAR(64),
    remind_before_minutes INTEGER DEFAULT 30,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_performance_subscription_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_performance_subscription_user
    ON performance_subscription(user_id, status, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_performance_subscription_activity
    ON performance_subscription(activity_id)
    WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_subscription_artist
    ON performance_subscription(artist_id)
    WHERE artist_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_performance_subscription_active_target
    ON performance_subscription(user_id, target_type, COALESCE(target_id, 0), COALESCE(target_value, ''))
    WHERE status = 1;
