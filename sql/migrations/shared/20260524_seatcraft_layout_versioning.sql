CREATE TABLE IF NOT EXISTS seat_layout_version (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    version_no INTEGER NOT NULL,
    version_status VARCHAR(20) NOT NULL,
    name VARCHAR(80),
    template_type VARCHAR(20),
    stage_title VARCHAR(80),
    stage_x INTEGER,
    stage_y INTEGER,
    canvas_width INTEGER,
    canvas_height INTEGER,
    base_version_id BIGINT REFERENCES seat_layout_version(id),
    published_at TIMESTAMP,
    published_by BIGINT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT chk_seat_layout_version_status CHECK (version_status IN ('draft', 'published', 'archived')),
    CONSTRAINT uq_seat_layout_version_no UNIQUE (owner_type, owner_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_layout_version_draft
    ON seat_layout_version(owner_type, owner_id)
    WHERE version_status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_layout_version_published
    ON seat_layout_version(owner_type, owner_id)
    WHERE version_status = 'published';

CREATE TABLE IF NOT EXISTS seat_layout_version_block (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    block_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    block_type VARCHAR(30) NOT NULL,
    x NUMERIC(12, 2) NOT NULL DEFAULT 0,
    y NUMERIC(12, 2) NOT NULL DEFAULT 0,
    rotation NUMERIC(8, 2) NOT NULL DEFAULT 0,
    scale NUMERIC(8, 2) NOT NULL DEFAULT 1,
    rows INTEGER,
    cols INTEGER,
    seats_per_row INTEGER,
    row_spacing NUMERIC(12, 2),
    seat_spacing NUMERIC(12, 2),
    inner_radius NUMERIC(12, 2),
    arc_start_angle NUMERIC(8, 2),
    arc_end_angle NUMERIC(8, 2),
    width NUMERIC(12, 2),
    height NUMERIC(12, 2),
    capacity INTEGER,
    polygon_points JSONB,
    color VARCHAR(20) NOT NULL DEFAULT '#ff1268',
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_block_type CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock', 'polygonBlock')),
    CONSTRAINT uq_seat_layout_version_block_key UNIQUE (version_id, block_key)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_override (
    id BIGSERIAL PRIMARY KEY,
    version_block_id BIGINT NOT NULL REFERENCES seat_layout_version_block(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    dx NUMERIC(12, 2) NOT NULL DEFAULT 0,
    dy NUMERIC(12, 2) NOT NULL DEFAULT 0,
    custom_label VARCHAR(40),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_override_status CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT uq_seat_layout_version_override_position UNIQUE (version_block_id, row_no, seat_no)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_ticket_group (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    group_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    default_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    activity_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_seat_layout_version_group_key UNIQUE (version_id, group_key)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_group_binding (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    block_key VARCHAR(80) NOT NULL,
    group_key VARCHAR(80) NOT NULL,
    binding_role VARCHAR(20) NOT NULL DEFAULT 'primary',
    sort INTEGER NOT NULL DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_binding_role CHECK (binding_role IN ('primary')),
    CONSTRAINT uq_seat_layout_version_binding UNIQUE (version_id, block_key, binding_role)
);

CREATE INDEX IF NOT EXISTS idx_seat_layout_version_owner ON seat_layout_version(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_block_version ON seat_layout_version_block(version_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_override_block ON seat_layout_version_override(version_block_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_group_version ON seat_layout_version_ticket_group(version_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_binding_version ON seat_layout_version_group_binding(version_id);
