CREATE TABLE IF NOT EXISTS tour (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    artist_id BIGINT,
    category_id BIGINT,
    poster VARCHAR(500),
    description TEXT,
    organizer_id BIGINT NOT NULL,
    review_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station (
    id BIGSERIAL PRIMARY KEY,
    tour_id BIGINT NOT NULL REFERENCES tour(id),
    city VARCHAR(80) NOT NULL,
    station_name VARCHAR(120) NOT NULL,
    poster VARCHAR(500),
    description TEXT,
    venue_application_id BIGINT,
    publish_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity ADD COLUMN IF NOT EXISTS tour_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS station_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_application_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS publish_status VARCHAR(30) NOT NULL DEFAULT 'published';

ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_note TEXT;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_file_url VARCHAR(500);
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS layout_snapshot JSONB;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS set_as_recommended_layout BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS seat_block (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    block_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    block_type VARCHAR(30) NOT NULL,
    ticket_group_key VARCHAR(80) NOT NULL,
    x NUMERIC(10,2) NOT NULL DEFAULT 0,
    y NUMERIC(10,2) NOT NULL DEFAULT 0,
    rotation NUMERIC(8,2) NOT NULL DEFAULT 0,
    scale NUMERIC(8,3) NOT NULL DEFAULT 1,
    rows INTEGER,
    cols INTEGER,
    seats_per_row INTEGER,
    row_spacing NUMERIC(10,2),
    seat_spacing NUMERIC(10,2),
    inner_radius NUMERIC(10,2),
    arc_start_angle NUMERIC(8,2),
    arc_end_angle NUMERIC(8,2),
    width NUMERIC(10,2),
    height NUMERIC(10,2),
    capacity INTEGER,
    color VARCHAR(20) NOT NULL DEFAULT '#ff1268',
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_block_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT chk_seat_block_type CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock')),
    CONSTRAINT uq_seat_block_key UNIQUE (owner_type, owner_id, block_key)
);

CREATE TABLE IF NOT EXISTS seat_override (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES seat_block(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    dx NUMERIC(10,2) NOT NULL DEFAULT 0,
    dy NUMERIC(10,2) NOT NULL DEFAULT 0,
    custom_label VARCHAR(80),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_override_status CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT uq_seat_override_position UNIQUE (block_id, row_no, seat_no)
);

CREATE TABLE IF NOT EXISTS ticket_group (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    group_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    default_price NUMERIC(10,2),
    activity_price NUMERIC(10,2),
    source_block_ids TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_group_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT uq_ticket_group_key UNIQUE (owner_type, owner_id, group_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS seat_block_id BIGINT;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS ticket_group_key VARCHAR(80);
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_row_no INTEGER;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_seat_no INTEGER;

CREATE INDEX IF NOT EXISTS idx_station_tour ON station(tour_id);
CREATE INDEX IF NOT EXISTS idx_activity_tour ON activity(tour_id);
CREATE INDEX IF NOT EXISTS idx_activity_station ON activity(station_id);
CREATE INDEX IF NOT EXISTS idx_activity_publish_status ON activity(publish_status);
CREATE INDEX IF NOT EXISTS idx_seat_block_owner ON seat_block(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_ticket_group_owner ON ticket_group(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_block ON session_seat(seat_block_id);
