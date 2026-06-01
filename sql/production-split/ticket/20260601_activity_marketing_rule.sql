-- owner: java-ticket

CREATE TABLE IF NOT EXISTS activity_marketing_rule (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    coupon_name VARCHAR(120),
    discount_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    threshold_amount NUMERIC(12, 2),
    discount_amount NUMERIC(12, 2),
    max_coupon_count INTEGER,
    per_user_limit INTEGER,
    claimed_count INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity_marketing_rule
    DROP CONSTRAINT IF EXISTS chk_activity_marketing_discount_type;
ALTER TABLE activity_marketing_rule
    ADD CONSTRAINT chk_activity_marketing_discount_type
    CHECK (discount_type IN ('NONE', 'FULL_REDUCTION', 'DIRECT_REDUCTION'));

ALTER TABLE activity_marketing_rule
    DROP CONSTRAINT IF EXISTS chk_activity_marketing_status;
ALTER TABLE activity_marketing_rule
    ADD CONSTRAINT chk_activity_marketing_status
    CHECK (status IN (0, 1));

ALTER TABLE activity_marketing_rule
    DROP CONSTRAINT IF EXISTS chk_activity_marketing_amount;
ALTER TABLE activity_marketing_rule
    ADD CONSTRAINT chk_activity_marketing_amount
    CHECK (
        (threshold_amount IS NULL OR threshold_amount >= 0)
        AND (discount_amount IS NULL OR discount_amount >= 0)
    );

ALTER TABLE activity_marketing_rule
    DROP CONSTRAINT IF EXISTS chk_activity_marketing_count;
ALTER TABLE activity_marketing_rule
    ADD CONSTRAINT chk_activity_marketing_count
    CHECK (
        (max_coupon_count IS NULL OR max_coupon_count > 0)
        AND (per_user_limit IS NULL OR per_user_limit > 0)
        AND claimed_count >= 0
        AND used_count >= 0
    );

CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_marketing_rule_activity
    ON activity_marketing_rule(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_marketing_rule_status
    ON activity_marketing_rule(status, enabled);
