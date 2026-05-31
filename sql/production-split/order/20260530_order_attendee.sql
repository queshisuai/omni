-- owner: java-order

CREATE SEQUENCE IF NOT EXISTS order_attendee_id_seq;

CREATE TABLE IF NOT EXISTS order_attendee (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT NOT NULL,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(128) NOT NULL,
    id_no_mask VARCHAR(64) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    status INTEGER NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_attendee_status CHECK (status IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_order_attendee_order
    ON order_attendee(order_id);

CREATE INDEX IF NOT EXISTS idx_order_attendee_seat
    ON order_attendee(order_seat_id);

CREATE INDEX IF NOT EXISTS idx_order_attendee_session_identity_active
    ON order_attendee(session_id, id_type, id_no_hash)
    WHERE status = 1;
