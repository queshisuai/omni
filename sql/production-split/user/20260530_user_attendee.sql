-- owner: java-user

CREATE SEQUENCE IF NOT EXISTS user_attendee_id_seq;

CREATE TABLE IF NOT EXISTS user_attendee (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(128) NOT NULL,
    id_no_mask VARCHAR(64) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status INTEGER NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_attendee_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_user_attendee_user_status
    ON user_attendee(user_id, status, is_default DESC, create_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_attendee_active_identity
    ON user_attendee(user_id, id_type, id_no_hash)
    WHERE status = 1;
