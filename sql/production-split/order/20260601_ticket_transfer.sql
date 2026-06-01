-- owner: java-order

ALTER TABLE order_snapshot
    ADD COLUMN IF NOT EXISTS ticket_transfer_allowed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE SEQUENCE IF NOT EXISTS ticket_transfer_id_seq;

CREATE TABLE IF NOT EXISTS ticket_transfer (
    id BIGSERIAL PRIMARY KEY,
    transfer_code VARCHAR(64) NOT NULL UNIQUE,
    ticket_id BIGINT NOT NULL REFERENCES electronic_ticket(id) ON DELETE CASCADE,
    new_ticket_id BIGINT REFERENCES electronic_ticket(id) ON DELETE SET NULL,
    from_user_id BIGINT NOT NULL,
    to_user_id BIGINT,
    status INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP NOT NULL,
    claimed_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_transfer_status CHECK (status IN (1, 2, 3, 4))
);

CREATE INDEX IF NOT EXISTS idx_ticket_transfer_ticket_status
    ON ticket_transfer(ticket_id, status, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_transfer_from_user
    ON ticket_transfer(from_user_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_transfer_to_user
    ON ticket_transfer(to_user_id, create_time DESC)
    WHERE to_user_id IS NOT NULL;
