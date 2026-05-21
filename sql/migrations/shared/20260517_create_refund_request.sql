CREATE TABLE IF NOT EXISTS refund_request (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id),
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    payment_id BIGINT REFERENCES payment(id),
    refund_no VARCHAR(64) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    alipay_refund_no VARCHAR(64),
    raw_response TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP,
    refund_time TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_request(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_order_active_unique ON refund_request(order_id) WHERE status IN (0, 1, 4);
CREATE INDEX IF NOT EXISTS idx_refund_user ON refund_request(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_request(status);
CREATE INDEX IF NOT EXISTS idx_refund_no ON refund_request(refund_no);
