ALTER TABLE activity ADD COLUMN IF NOT EXISTS risk_suspended_reason TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS risk_suspended_at TIMESTAMP;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS risk_restored_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS activity_risk_resolution (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL,
    organizer_id BIGINT NOT NULL,
    risk_artist_id BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    resolution_note TEXT,
    review_note TEXT,
    submitted_by BIGINT NOT NULL,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_risk_resolution_activity ON activity_risk_resolution(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_risk_resolution_organizer ON activity_risk_resolution(organizer_id);
CREATE INDEX IF NOT EXISTS idx_activity_risk_resolution_status ON activity_risk_resolution(status);
