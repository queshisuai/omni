-- owner: java-user

CREATE TABLE IF NOT EXISTS user_permission_override (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    permission_code VARCHAR(64) NOT NULL,
    override_type VARCHAR(16) NOT NULL CHECK (override_type IN ('ALLOW', 'DENY')),
    reason VARCHAR(255),
    create_by BIGINT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_perm UNIQUE (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_perm_uid ON user_permission_override(user_id);
