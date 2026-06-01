-- owner: java-user

CREATE TABLE IF NOT EXISTS support_account (
    user_id BIGINT PRIMARY KEY REFERENCES "user"(id),
    phone VARCHAR(20) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_account_status CHECK (status IN (0, 1))
);

INSERT INTO support_account (user_id, phone, nickname, status, create_time, update_time)
SELECT
    id,
    phone,
    COALESCE(NULLIF(nickname, ''), '客服' || id),
    COALESCE(status, 1),
    COALESCE(create_time, CURRENT_TIMESTAMP),
    COALESCE(update_time, CURRENT_TIMESTAMP)
FROM "user"
WHERE role = 'support'
ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    nickname = EXCLUDED.nickname,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_support_account_status_time
    ON support_account(status, update_time DESC);
