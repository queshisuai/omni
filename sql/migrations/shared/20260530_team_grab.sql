-- owner: grab-service

CREATE TABLE IF NOT EXISTS grab_request (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    seat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    allocate_random BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL,
    request_type VARCHAR(32) NOT NULL DEFAULT 'NORMAL_GRAB',
    queue_seq BIGINT,
    requested_ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    allow_auto_downgrade BOOLEAN NOT NULL DEFAULT FALSE,
    current_ticket_type_id BIGINT,
    current_attempt_index INTEGER NOT NULL DEFAULT 0,
    matched_ticket_type_id BIGINT,
    progress_status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    progress_message VARCHAR(512),
    attempts_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_id BIGINT,
    fail_reason VARCHAR(512),
    worker_claimed_at TIMESTAMPTZ,
    worker_id VARCHAR(128),
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expire_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_grab_request_request_id UNIQUE (request_id),
    CONSTRAINT uk_grab_request_user_idempotency UNIQUE (user_id, idempotency_key),
    CONSTRAINT chk_grab_request_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_grab_request_status CHECK (status IN (
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'PENDING',
        'ACCEPTED',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'PENDING_RECOVERY',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    )),
    CONSTRAINT chk_grab_request_progress_status CHECK (progress_status IN (
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'PENDING_RECOVERY',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_grab_request_status_expire_time
    ON grab_request(status, expire_time);

CREATE INDEX IF NOT EXISTS idx_grab_request_user_created_at
    ON grab_request(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grab_request_session_queue_seq
    ON grab_request(session_id, queue_seq);

CREATE INDEX IF NOT EXISTS idx_grab_request_progress_expire_time
    ON grab_request(progress_status, expire_time);

CREATE TABLE IF NOT EXISTS ticket_team (
    id BIGSERIAL PRIMARY KEY,
    invite_code VARCHAR(32) NOT NULL,
    leader_user_id BIGINT NOT NULL,
    activity_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    strategy VARCHAR(32) NOT NULL DEFAULT 'STRICT_CONTIGUOUS',
    fallback_strategy_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_ticket_team_invite_code UNIQUE (invite_code),
    CONSTRAINT chk_ticket_team_size CHECK (size BETWEEN 1 AND 6),
    CONSTRAINT chk_ticket_team_strategy CHECK (strategy IN ('STRICT_CONTIGUOUS', 'SAME_BLOCK', 'SAME_TICKET_TYPE', 'FALLBACK')),
    CONSTRAINT chk_ticket_team_status CHECK (status IN ('DRAFT', 'READY', 'GRABBING', 'LOCKED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
);

CREATE TABLE IF NOT EXISTS ticket_team_member (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id) ON DELETE CASCADE,
    session_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    seat_id BIGINT,
    order_seat_id BIGINT,
    join_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_ticket_team_member_team_user UNIQUE (team_id, user_id),
    CONSTRAINT chk_ticket_team_member_role CHECK (role IN ('LEADER', 'MEMBER')),
    CONSTRAINT chk_ticket_team_member_status CHECK (status IN ('INVITED', 'JOINED', 'CONFIRMED', 'LEFT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ticket_team_member_active_session
    ON ticket_team_member(user_id, session_id)
    WHERE status IN ('JOINED', 'CONFIRMED');

CREATE TABLE IF NOT EXISTS team_grab_request (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    grab_request_id VARCHAR(64) NOT NULL,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id),
    trigger_user_id BIGINT NOT NULL,
    payer_user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    strategy VARCHAR(32) NOT NULL,
    fallback_strategy_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_strategy VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    order_id BIGINT,
    locked_seat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    seat_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    fail_reason VARCHAR(512),
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_team_grab_request_request_id UNIQUE (request_id),
    CONSTRAINT uk_team_grab_request_grab_request_id UNIQUE (grab_request_id),
    CONSTRAINT chk_team_grab_request_quantity CHECK (quantity BETWEEN 2 AND 6),
    CONSTRAINT chk_team_grab_request_status CHECK (status IN ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED', 'FAILED', 'EXPIRED'))
);

ALTER TABLE team_grab_request
    ADD COLUMN IF NOT EXISTS grab_request_id VARCHAR(64);

UPDATE team_grab_request
SET grab_request_id = 'TEAM-GRAB-LEGACY-' || id::text
WHERE grab_request_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM team_grab_request
        WHERE grab_request_id IS NULL
    ) THEN
        RAISE EXCEPTION 'team_grab_request.grab_request_id still contains null values';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM team_grab_request
        GROUP BY grab_request_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'team_grab_request.grab_request_id contains duplicate values';
    END IF;
END $$;

ALTER TABLE team_grab_request
    ALTER COLUMN grab_request_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_team_grab_request_grab_request_id
    ON team_grab_request(grab_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_team_grab_request_active_team
    ON team_grab_request(team_id)
    WHERE status IN ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED');

CREATE TABLE IF NOT EXISTS team_seat_assignment (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id),
    user_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    order_seat_id BIGINT NOT NULL,
    session_seat_id BIGINT NOT NULL,
    seat_label VARCHAR(128),
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_team_assignment_team_user UNIQUE (team_id, user_id),
    CONSTRAINT uk_team_assignment_order_seat UNIQUE (order_seat_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_team_leader
    ON ticket_team(leader_user_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_team_session
    ON ticket_team(session_id, status);

CREATE INDEX IF NOT EXISTS idx_ticket_team_member_team
    ON ticket_team_member(team_id, status, join_time);

CREATE INDEX IF NOT EXISTS idx_team_grab_request_order
    ON team_grab_request(order_id);

CREATE INDEX IF NOT EXISTS idx_team_grab_request_grab_request
    ON team_grab_request(grab_request_id);
