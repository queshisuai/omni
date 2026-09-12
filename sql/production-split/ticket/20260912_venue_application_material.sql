-- owner: java-ticket
-- Structured venue application materials and venue metadata extensions.
ALTER TABLE venue_application
    ADD COLUMN IF NOT EXISTS venue_name_en VARCHAR(200),
    ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS province VARCHAR(50),
    ADD COLUMN IF NOT EXISTS district VARCHAR(50);

ALTER TABLE venue
    ADD COLUMN IF NOT EXISTS venue_name_en VARCHAR(200),
    ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS province VARCHAR(50),
    ADD COLUMN IF NOT EXISTS district VARCHAR(50);

CREATE TABLE IF NOT EXISTS venue_application_material (
    id BIGSERIAL PRIMARY KEY,
    venue_application_id BIGINT NOT NULL,
    material_type VARCHAR(50) NOT NULL,
    asset_id BIGINT NOT NULL,
    note TEXT,
    valid_from TIMESTAMP,
    valid_to TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_application_material_type
        CHECK (material_type IN ('FIRE_SAFETY_PERMIT', 'VENUE_LEASE_AGREEMENT')),
    CONSTRAINT fk_venue_application_material_application
        FOREIGN KEY (venue_application_id) REFERENCES venue_application(id),
    CONSTRAINT fk_venue_application_material_asset
        FOREIGN KEY (asset_id) REFERENCES private_asset(id)
);

CREATE INDEX IF NOT EXISTS idx_vam_application_type
    ON venue_application_material(venue_application_id, material_type);
CREATE INDEX IF NOT EXISTS idx_vam_asset
    ON venue_application_material(asset_id);
