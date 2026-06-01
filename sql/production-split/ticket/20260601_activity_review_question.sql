-- owner: java-ticket

CREATE TABLE IF NOT EXISTS activity_review (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    order_id BIGINT,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    images TEXT,
    like_count INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_question (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    answer TEXT,
    answered_by BIGINT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    CONSTRAINT chk_activity_question_status CHECK (status IN ('PENDING', 'ANSWERED', 'HIDDEN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_review_order_active
    ON activity_review(activity_id, user_id, order_id)
    WHERE order_id IS NOT NULL AND status = 1;
CREATE INDEX IF NOT EXISTS idx_activity_review_activity_time
    ON activity_review(activity_id, status, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_activity_question_activity_time
    ON activity_question(activity_id, status, create_time DESC);
