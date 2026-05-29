CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS ticket_service;
CREATE SCHEMA IF NOT EXISTS payment_service;

CREATE TABLE IF NOT EXISTS order_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_order_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_order_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_order_service_undo_log_log_created ON order_service.undo_log (log_created);

CREATE TABLE IF NOT EXISTS ticket_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_ticket_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_ticket_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_service_undo_log_log_created ON ticket_service.undo_log (log_created);

CREATE TABLE IF NOT EXISTS payment_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_payment_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_payment_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_service_undo_log_log_created ON payment_service.undo_log (log_created);
