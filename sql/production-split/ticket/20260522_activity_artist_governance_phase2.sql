-- owner: java-ticket

ALTER TABLE artist ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'approved';
ALTER TABLE artist ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS submitted_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS update_time TIMESTAMP;

UPDATE artist SET review_status = 'approved' WHERE review_status IS NULL;
UPDATE artist SET risk_status = 'normal' WHERE risk_status IS NULL;
UPDATE artist SET status = 1 WHERE status IS NULL;
UPDATE artist SET update_time = COALESCE(update_time, create_time, CURRENT_TIMESTAMP) WHERE update_time IS NULL;

ALTER TABLE artist ALTER COLUMN review_status SET DEFAULT 'approved';
ALTER TABLE artist DROP CONSTRAINT IF EXISTS chk_artist_risk_status;
ALTER TABLE artist ADD CONSTRAINT chk_artist_risk_status CHECK (risk_status IN ('normal', 'risky'));

CREATE INDEX IF NOT EXISTS idx_artist_review_status ON artist(review_status);
CREATE INDEX IF NOT EXISTS idx_artist_risk_status ON artist(risk_status);
