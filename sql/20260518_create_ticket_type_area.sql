CREATE TABLE ticket_type_area (
    id BIGSERIAL PRIMARY KEY,
    ticket_type_id BIGINT NOT NULL REFERENCES ticket_type(id),
    session_id BIGINT NOT NULL REFERENCES session(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_type_area_ticket_type ON ticket_type_area(ticket_type_id);
CREATE INDEX idx_ticket_type_area_session ON ticket_type_area(session_id);
CREATE UNIQUE INDEX idx_ticket_type_area_session_area_unique ON ticket_type_area(session_id, area_id);
