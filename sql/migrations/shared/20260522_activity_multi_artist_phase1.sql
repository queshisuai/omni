ALTER TABLE artist ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS artist_type VARCHAR(60);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS country_or_region VARCHAR(120);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS agency VARCHAR(255);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS representative_works TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS category_tags VARCHAR(500);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS external_links TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS source_note TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_status VARCHAR(30) NOT NULL DEFAULT 'normal';
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_reason TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_marked_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_marked_at TIMESTAMP;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_cleared_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_cleared_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_artist_risk_status'
          AND conrelid = 'artist'::regclass
    ) THEN
        ALTER TABLE artist ADD CONSTRAINT chk_artist_risk_status CHECK (risk_status IN ('normal', 'risk', 'blocked', 'disabled'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artist_name ON artist(name);
CREATE INDEX IF NOT EXISTS idx_artist_alias ON artist(alias);
CREATE INDEX IF NOT EXISTS idx_artist_tags ON artist(category_tags);
CREATE INDEX IF NOT EXISTS idx_artist_risk_status ON artist(risk_status);

CREATE TABLE IF NOT EXISTS activity_artist (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    artist_id BIGINT NOT NULL REFERENCES artist(id),
    sort INTEGER NOT NULL DEFAULT 1,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    role_type VARCHAR(60) NOT NULL DEFAULT 'performer',
    role_name VARCHAR(120),
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_artist_visibility CHECK (visibility IN ('public', 'hidden')),
    CONSTRAINT chk_activity_artist_status CHECK (status IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_artist_active_artist
    ON activity_artist(activity_id, artist_id)
    WHERE status = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_artist_primary
    ON activity_artist(activity_id)
    WHERE status = 1 AND is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_activity_artist_activity ON activity_artist(activity_id, sort, id);
CREATE INDEX IF NOT EXISTS idx_activity_artist_artist ON activity_artist(artist_id);

INSERT INTO activity_artist (activity_id, artist_id, sort, is_primary, role_type, role_name, visibility, status)
SELECT a.id, a.artist_id, 1, TRUE, 'primary', '主艺人', 'public', 1
FROM activity a
WHERE a.artist_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM activity_artist aa
      WHERE aa.activity_id = a.id
        AND aa.artist_id = a.artist_id
        AND aa.status = 1
  );
