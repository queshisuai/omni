-- Private ticket-side assets. Files are stored on disk, not in PostgreSQL.
CREATE TABLE IF NOT EXISTS private_asset (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL DEFAULT 'ticket',
  biz_type VARCHAR(50) NOT NULL,
  biz_id BIGINT,
  uploader_id BIGINT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  relative_path VARCHAR(500) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bind_time TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_private_asset_uploader ON private_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_biz ON private_asset(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_status ON private_asset(status);

ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_asset_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_venue_application_proof_asset ON venue_application(proof_asset_id);
