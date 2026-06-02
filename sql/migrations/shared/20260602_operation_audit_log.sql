-- owner: java-user

CREATE TABLE IF NOT EXISTS operation_audit_log (
    id BIGSERIAL PRIMARY KEY,
    operator_id BIGINT NOT NULL,
    operator_role VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id BIGINT,
    target_ref VARCHAR(128),
    reason TEXT,
    result TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    trace_id VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_audit_operator_time
    ON operation_audit_log(operator_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_operation_audit_trace_id
    ON operation_audit_log(trace_id);
