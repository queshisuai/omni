ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS user_hidden BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS user_deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS user_delete_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_order_user_hidden
    ON "order"(user_id, user_hidden, user_delete_expires_at);
