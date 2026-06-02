-- owner: java-user

CREATE TABLE IF NOT EXISTS exception_task (
    id BIGSERIAL PRIMARY KEY,
    task_type VARCHAR(64) NOT NULL,
    business_no VARCHAR(128),
    order_no VARCHAR(128),
    payment_no VARCHAR(128),
    refund_no VARCHAR(128),
    ticket_no VARCHAR(128),
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reason TEXT,
    result TEXT,
    operator_id BIGINT,
    operator_role VARCHAR(64),
    trace_id VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exception_task_evidence (
    id BIGSERIAL PRIMARY KEY,
    exception_id BIGINT NOT NULL REFERENCES exception_task(id),
    url VARCHAR(1024) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_batch (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(128) NOT NULL UNIQUE,
    biz_date DATE NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'local',
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    summary_json TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_difference (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(128) NOT NULL,
    diff_type VARCHAR(64) NOT NULL,
    business_no VARCHAR(128),
    expected_amount NUMERIC(18,2),
    actual_amount NUMERIC(18,2),
    diff_amount NUMERIC(18,2),
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exception_task_status
    ON exception_task(status);
CREATE INDEX IF NOT EXISTS idx_exception_task_business_no
    ON exception_task(business_no);
CREATE INDEX IF NOT EXISTS idx_reconciliation_batch_biz_date
    ON reconciliation_batch(biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_diff_batch
    ON reconciliation_difference(batch_no);
