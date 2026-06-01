-- owner: java-user

CREATE TABLE IF NOT EXISTS user_browse_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    activity_id BIGINT NOT NULL,
    activity_name VARCHAR(200) NOT NULL,
    poster VARCHAR(500),
    category VARCHAR(80),
    artist VARCHAR(200),
    city VARCHAR(80),
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_browse_history_user_activity
    ON user_browse_history(user_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_user_browse_history_user_time
    ON user_browse_history(user_id, viewed_at DESC, id DESC);
