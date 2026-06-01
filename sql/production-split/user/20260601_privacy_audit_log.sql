-- owner: java-user

CREATE SEQUENCE IF NOT EXISTS privacy_audit_log_id_seq;

CREATE TABLE IF NOT EXISTS privacy_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id BIGINT,
    detail TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_actor_time
    ON privacy_audit_log(actor_user_id, create_time DESC);
