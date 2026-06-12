-- owner: java-ticket
-- activity_review.status: 0=待审核, 1=已展示, 2=已隐藏

CREATE TABLE IF NOT EXISTS activity_review (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    order_id BIGINT,
    rating SMALLINT NOT NULL,
    content TEXT,
    images TEXT,
    like_count INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity_review
    ADD COLUMN IF NOT EXISTS order_id BIGINT,
    ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_activity_review_activity_time
    ON activity_review (activity_id, create_time DESC, id DESC);

DROP INDEX IF EXISTS uk_activity_review_order_active;

CREATE UNIQUE INDEX uk_activity_review_order_active
    ON activity_review (activity_id, user_id, order_id)
    WHERE order_id IS NOT NULL AND status IN (0, 1);

CREATE TABLE IF NOT EXISTS activity_question (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    answer TEXT,
    answered_by BIGINT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP
);

ALTER TABLE activity_question
    ADD COLUMN IF NOT EXISTS answer TEXT,
    ADD COLUMN IF NOT EXISTS answered_by BIGINT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_activity_question_activity_time
    ON activity_question (activity_id, create_time DESC, id DESC);

CREATE TABLE IF NOT EXISTS activity_review_report (
    id BIGSERIAL PRIMARY KEY,
    review_id BIGINT NOT NULL REFERENCES activity_review(id),
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    handled_by BIGINT,
    handle_note TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    handled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_review_report_status_time
    ON activity_review_report (status, create_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_review_report_review
    ON activity_review_report (review_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_review_report_pending_user
    ON activity_review_report (review_id, user_id)
    WHERE status = 'PENDING';
