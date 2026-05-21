CREATE TABLE venue_area (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    name VARCHAR(100) NOT NULL,
    row_count INTEGER NOT NULL,
    seats_per_row INTEGER NOT NULL,
    row_start INTEGER DEFAULT 1,
    seat_start INTEGER DEFAULT 1,
    color VARCHAR(20),
    sort INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venue_seat (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    seat_label VARCHAR(30) NOT NULL,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_venue_area_venue ON venue_area(venue_id);
CREATE INDEX idx_venue_area_status ON venue_area(status);
CREATE INDEX idx_venue_seat_venue ON venue_seat(venue_id);
CREATE INDEX idx_venue_seat_area ON venue_seat(area_id);
CREATE UNIQUE INDEX idx_venue_seat_area_position ON venue_seat(area_id, row_no, seat_no) WHERE status = 1;
