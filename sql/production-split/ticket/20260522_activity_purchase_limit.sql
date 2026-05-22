-- owner: java-ticket

ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS per_user_limit INTEGER;

ALTER TABLE activity
    DROP CONSTRAINT IF EXISTS ck_activity_per_user_limit_positive;

ALTER TABLE activity
    ADD CONSTRAINT ck_activity_per_user_limit_positive
    CHECK (per_user_limit IS NULL OR per_user_limit > 0);
