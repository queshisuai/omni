-- owner: java-order

CREATE SEQUENCE IF NOT EXISTS electronic_ticket_id_seq;

CREATE TABLE IF NOT EXISTS electronic_ticket (
    id BIGSERIAL PRIMARY KEY,
    ticket_no VARCHAR(64) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL,
    original_user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT,
    real_name VARCHAR(80),
    id_type VARCHAR(32),
    id_no_mask VARCHAR(64),
    phone VARCHAR(32),
    seat_label VARCHAR(128),
    status INTEGER NOT NULL DEFAULT 1,
    checked_in_at TIMESTAMP,
    invalid_reason VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_electronic_ticket_status CHECK (status IN (1, 2, 3, 4))
);

CREATE INDEX IF NOT EXISTS idx_electronic_ticket_user_status
    ON electronic_ticket(user_id, status, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_ticket_order
    ON electronic_ticket(order_id);

CREATE INDEX IF NOT EXISTS idx_electronic_ticket_session
    ON electronic_ticket(session_id, ticket_type_id, status);
