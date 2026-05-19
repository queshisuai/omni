CREATE TABLE venue_seat_layout_template (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL DEFAULT '演出舞台 / STAGE',
    stage_x INTEGER NOT NULL DEFAULT 500,
    stage_y INTEGER NOT NULL DEFAULT 50,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_seat_layout_template_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE venue_seat_layout_template_section (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES venue_seat_layout_template(id) ON DELETE CASCADE,
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_template_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_template_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_template_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_template_section_key UNIQUE (template_id, section_key)
);

CREATE TABLE activity_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    layout_mode VARCHAR(20) NOT NULL DEFAULT 'unified',
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_seat_layout_mode CHECK (layout_mode IN ('unified', 'per_session')),
    CONSTRAINT chk_activity_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE activity_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    activity_layout_id BIGINT NOT NULL REFERENCES activity_seat_layout(id) ON DELETE CASCADE,
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_activity_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_activity_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_activity_section_key UNIQUE (activity_layout_id, section_key)
);

CREATE TABLE session_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL UNIQUE REFERENCES session(id) ON DELETE CASCADE,
    activity_layout_id BIGINT REFERENCES activity_seat_layout(id),
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE session_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    session_layout_id BIGINT NOT NULL REFERENCES session_seat_layout(id) ON DELETE CASCADE,
    activity_layout_section_id BIGINT REFERENCES activity_seat_layout_section(id),
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    seat_count INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_session_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_session_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_session_section_key UNIQUE (session_layout_id, section_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS layout_section_id BIGINT REFERENCES session_seat_layout_section(id);

CREATE INDEX idx_venue_seat_layout_template_venue ON venue_seat_layout_template(venue_id);
CREATE INDEX idx_template_section_template ON venue_seat_layout_template_section(template_id);
CREATE INDEX idx_activity_seat_layout_activity ON activity_seat_layout(activity_id);
CREATE INDEX idx_activity_section_layout ON activity_seat_layout_section(activity_layout_id);
CREATE INDEX idx_session_seat_layout_session ON session_seat_layout(session_id);
CREATE INDEX idx_session_section_layout ON session_seat_layout_section(session_layout_id);
CREATE INDEX idx_session_section_ticket_type ON session_seat_layout_section(ticket_type_id);
CREATE INDEX idx_session_seat_layout_section ON session_seat(layout_section_id);
CREATE UNIQUE INDEX idx_session_seat_layout_position ON session_seat(session_id, layout_section_id, row_no, seat_no) WHERE layout_section_id IS NOT NULL;
