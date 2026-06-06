-- owner: java-order

CREATE SEQUENCE IF NOT EXISTS check_in_device_id_seq;
CREATE SEQUENCE IF NOT EXISTS ticket_check_in_record_id_seq;

CREATE TABLE IF NOT EXISTS check_in_device (
    id BIGSERIAL PRIMARY KEY,
    device_code VARCHAR(64) NOT NULL UNIQUE,
    device_name VARCHAR(128) NOT NULL,
    organizer_id BIGINT,
    session_id BIGINT,
    status SMALLINT NOT NULL DEFAULT 1,
    secret_hash VARCHAR(128),
    last_seen_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_check_in_device_status CHECK (status IN (0, 1))
);

CREATE TABLE IF NOT EXISTS ticket_check_in_record (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(96) NOT NULL UNIQUE,
    ticket_id BIGINT,
    ticket_no VARCHAR(64),
    order_id BIGINT,
    user_id BIGINT,
    session_id BIGINT,
    ticket_type_id BIGINT,
    device_code VARCHAR(64),
    operator_user_id BIGINT,
    channel VARCHAR(32) NOT NULL,
    result VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(255),
    checked_in_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_check_in_channel CHECK (channel IN ('GATE', 'STAFF_APP', 'WEB_BACKUP', 'INTERNAL_SYNC')),
    CONSTRAINT chk_ticket_check_in_result CHECK (result IN ('SUCCESS', 'DUPLICATE', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_session_time
    ON ticket_check_in_record(session_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_ticket
    ON ticket_check_in_record(ticket_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_result
    ON ticket_check_in_record(result, create_time DESC);
