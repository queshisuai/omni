-- 本文件仅用于本地 disposable database / schema isolation 实验。
-- 禁止用于 staging / production，禁止接入生产迁移流程。
-- 执行前必须备份或重建本地 omni_ticket 数据库。
-- 执行前必须先在本地库执行 sql/local/20260520_drop_cross_owner_fks_local_only.sql。
-- 本文件只创建本地服务 schema 并移动已登记 owner 的表，不删除表、不删除列、不修改数据。

BEGIN;

CREATE SCHEMA IF NOT EXISTS user_service;
CREATE SCHEMA IF NOT EXISTS ticket_service;
CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS payment_service;
CREATE SCHEMA IF NOT EXISTS notification_service;

-- java-user owned tables
ALTER TABLE IF EXISTS "user" SET SCHEMA user_service;
ALTER TABLE IF EXISTS user_auth SET SCHEMA user_service;
ALTER TABLE IF EXISTS sms_code SET SCHEMA user_service;
ALTER TABLE IF EXISTS organizer_application SET SCHEMA user_service;

-- java-ticket owned tables
ALTER TABLE IF EXISTS category SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS artist SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS tour SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS station SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS activity SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_application SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS session SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS ticket_type SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS ticket_type_area SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS session_seat SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_area SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_seat SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS reservation SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS seat SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS stock_log SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_seat_layout_template SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_seat_layout_template_section SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_default_layout SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS venue_default_layout_section SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS activity_seat_layout SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS activity_seat_layout_section SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS session_seat_layout SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS session_seat_layout_section SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS seat_block SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS seat_override SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS ticket_group SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS layout_section SET SCHEMA ticket_service;

-- java-order owned tables
ALTER TABLE IF EXISTS "order" SET SCHEMA order_service;
ALTER TABLE IF EXISTS order_seat SET SCHEMA order_service;
ALTER TABLE IF EXISTS order_snapshot SET SCHEMA order_service;

-- Some disposable local databases were created before order_snapshot existed.
-- Keep this local-only script idempotent so the order service can write snapshots
-- after schema isolation without relying on ticket-owned tables at read time.
CREATE TABLE IF NOT EXISTS order_service.order_snapshot (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    activity_id BIGINT,
    activity_name VARCHAR(255),
    activity_poster VARCHAR(500),
    tour_id BIGINT,
    station_id BIGINT,
    session_id BIGINT,
    session_time TIMESTAMP,
    venue_name VARCHAR(255),
    ticket_type_id BIGINT,
    ticket_name VARCHAR(255),
    unit_price NUMERIC(10, 2),
    quantity INTEGER,
    seat_labels TEXT,
    seat_selection_mode VARCHAR(32),
    grab_request_id VARCHAR(64),
    requested_ticket_type_id BIGINT,
    matched_ticket_type_id BIGINT,
    auto_downgraded BOOLEAN NOT NULL DEFAULT FALSE,
    team_id BIGINT,
    team_grab_request_id VARCHAR(64),
    team_order BOOLEAN NOT NULL DEFAULT FALSE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id) REFERENCES order_service."order"(id) ON DELETE CASCADE
);

ALTER TABLE IF EXISTS order_service.order_seat
    ADD COLUMN IF NOT EXISTS seat_label VARCHAR(128);

ALTER TABLE IF EXISTS order_service.order_snapshot
    ADD COLUMN IF NOT EXISTS grab_request_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS seat_selection_mode VARCHAR(32),
    ADD COLUMN IF NOT EXISTS requested_ticket_type_id BIGINT,
    ADD COLUMN IF NOT EXISTS matched_ticket_type_id BIGINT,
    ADD COLUMN IF NOT EXISTS auto_downgraded BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS team_id BIGINT,
    ADD COLUMN IF NOT EXISTS team_grab_request_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS team_order BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_service.order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_service.order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_service.order_snapshot(session_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_grab_request_id ON order_service.order_snapshot(grab_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_order_snapshot_grab_request_id
    ON order_service.order_snapshot(grab_request_id)
    WHERE grab_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_snapshot_team_id
    ON order_service.order_snapshot(team_id)
    WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_order_snapshot_team_grab_request
    ON order_service.order_snapshot(team_grab_request_id)
    WHERE team_order = TRUE AND team_grab_request_id IS NOT NULL;

-- java-payment owned tables
ALTER TABLE IF EXISTS payment SET SCHEMA payment_service;
ALTER TABLE IF EXISTS refund_request SET SCHEMA payment_service;

-- java-notification owned tables
ALTER TABLE IF EXISTS notification SET SCHEMA notification_service;

-- legacy removed feature tables remain isolated under ticket_service until cleanup ownership is finalized.
ALTER TABLE IF EXISTS review SET SCHEMA ticket_service;
ALTER TABLE IF EXISTS moment SET SCHEMA ticket_service;

COMMIT;
