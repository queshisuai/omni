DROP TABLE IF EXISTS order_seat;

CREATE TABLE order_seat (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id),
    session_seat_id BIGINT NOT NULL REFERENCES session_seat(id),
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    status SMALLINT DEFAULT 1,
    seat_label VARCHAR(128),
    lock_expire_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_seat_order ON order_seat(order_id);
CREATE INDEX idx_order_seat_session_seat ON order_seat(session_seat_id);
CREATE INDEX idx_order_seat_status ON order_seat(status);
