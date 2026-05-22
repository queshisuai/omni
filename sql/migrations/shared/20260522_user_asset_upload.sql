CREATE TABLE IF NOT EXISTS user_asset (
    id BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_asset_uploader ON user_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_user_asset_biz_type ON user_asset(biz_type);
