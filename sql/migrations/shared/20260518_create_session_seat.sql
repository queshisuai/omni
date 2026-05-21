CREATE TABLE session_seat (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES session(id),
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    venue_seat_id BIGINT NOT NULL REFERENCES venue_seat(id),
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    seat_label VARCHAR(30) NOT NULL,
    status SMALLINT DEFAULT 1,
    lock_expire_time TIMESTAMP,
    order_id BIGINT REFERENCES "order"(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_seat_session ON session_seat(session_id);
CREATE INDEX idx_session_seat_venue ON session_seat(venue_id);
CREATE INDEX idx_session_seat_area ON session_seat(area_id);
CREATE INDEX idx_session_seat_status ON session_seat(status);
CREATE UNIQUE INDEX idx_session_seat_session_venue_seat ON session_seat(session_id, venue_seat_id);
