-- owner: java-user

BEGIN;

CREATE TABLE IF NOT EXISTS organizer_application_material (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES organizer_application(id),
    asset_id BIGINT NOT NULL REFERENCES user_asset(id),
    material_type VARCHAR(64) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_organizer_application_user_id;
CREATE INDEX IF NOT EXISTS idx_organizer_application_user_id
    ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_material_application
    ON organizer_application_material(application_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_organizer_application_material_type
    ON organizer_application_material(application_id, material_type);
CREATE UNIQUE INDEX IF NOT EXISTS uk_organizer_application_material_asset
    ON organizer_application_material(application_id, asset_id);

COMMIT;
