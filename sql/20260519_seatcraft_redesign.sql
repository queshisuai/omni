-- SeatCraft Redesign: Venue Default Layout instead of public template library
-- Created: 2026-05-19

-- 1. Create new venue_default_layout table
CREATE TABLE venue_default_layout (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL UNIQUE REFERENCES venue(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL DEFAULT 'custom',
    stage_title VARCHAR(80) NOT NULL DEFAULT '演出舞台 / STAGE',
    stage_x INTEGER NOT NULL DEFAULT 500,
    stage_y INTEGER NOT NULL DEFAULT 50,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_default_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

-- 2. Create new venue_default_layout_section table
CREATE TABLE venue_default_layout_section (
    id BIGSERIAL PRIMARY KEY,
    layout_id BIGINT NOT NULL REFERENCES venue_default_layout(id) ON DELETE CASCADE,
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
    CONSTRAINT chk_venue_default_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_venue_default_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_venue_default_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_venue_default_section_key UNIQUE (layout_id, section_key)
);

-- 3. Create indexes
CREATE INDEX idx_venue_default_layout ON venue_default_layout(venue_id);
CREATE INDEX idx_venue_default_section_layout ON venue_default_layout_section(layout_id);

-- 4. Alter activity_seat_layout: remove old fields, add new
ALTER TABLE activity_seat_layout DROP CONSTRAINT IF EXISTS activity_seat_layout_source_template_id_fkey;
ALTER TABLE activity_seat_layout DROP COLUMN IF EXISTS source_template_id;
ALTER TABLE activity_seat_layout DROP COLUMN IF EXISTS layout_mode;
ALTER TABLE activity_seat_layout ADD COLUMN source_venue_layout_id BIGINT REFERENCES venue_default_layout(id);

-- 5. Alter session_seat_layout: remove old field
ALTER TABLE session_seat_layout DROP CONSTRAINT IF EXISTS session_seat_layout_source_template_id_fkey;
ALTER TABLE session_seat_layout DROP COLUMN IF EXISTS source_template_id;

-- 6. Drop FK constraints referencing old tables
ALTER TABLE activity_seat_layout_section DROP CONSTRAINT IF EXISTS activity_seat_layout_section_source_template_section_id_fkey;
ALTER TABLE session_seat_layout_section DROP CONSTRAINT IF EXISTS session_seat_layout_section_source_template_section_id_fkey;

-- 7. Drop old template tables
DROP INDEX IF EXISTS idx_venue_seat_layout_template_venue;
DROP INDEX IF EXISTS idx_template_section_template;
DROP TABLE IF EXISTS venue_seat_layout_template_section CASCADE;
DROP TABLE IF EXISTS venue_seat_layout_template CASCADE;
