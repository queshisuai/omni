-- owner: grab-service

CREATE SEQUENCE IF NOT EXISTS waitlist_priority_seq;

CREATE TABLE IF NOT EXISTS waitlist_entry (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    seat_preference JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'WAITING',
    priority_no BIGINT NOT NULL DEFAULT nextval('waitlist_priority_seq'),
    offer_order_id BIGINT,
    offer_expire_time TIMESTAMP,
    fail_reason VARCHAR(512),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_entry_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_entry_status CHECK (status IN (
        'WAITING', 'ALLOCATING', 'OFFERED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'
    ))
);

ALTER TABLE waitlist_entry
    ADD COLUMN IF NOT EXISTS attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_entry_active_user_ticket
    ON waitlist_entry(user_id, session_id, ticket_type_id)
    WHERE status IN ('WAITING', 'ALLOCATING', 'OFFERED');

CREATE INDEX IF NOT EXISTS idx_waitlist_entry_queue
    ON waitlist_entry(session_id, ticket_type_id, status, priority_no, create_time, id);

CREATE INDEX IF NOT EXISTS idx_waitlist_entry_user
    ON waitlist_entry(user_id, create_time DESC);

CREATE TABLE IF NOT EXISTS waitlist_offer (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES waitlist_entry(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFERED',
    expire_time TIMESTAMP NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_offer_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_offer_status CHECK (status IN ('OFFERED', 'PAID', 'EXPIRED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_offer_order
    ON waitlist_offer(order_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_offer_entry
    ON waitlist_offer(entry_id, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expire
    ON waitlist_offer(status, expire_time);

CREATE TABLE IF NOT EXISTS waitlist_allocation_log (
    id BIGSERIAL PRIMARY KEY,
    event_key VARCHAR(160) NOT NULL,
    attempt_no INTEGER NOT NULL DEFAULT 0,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    released_quantity INTEGER NOT NULL,
    allocated_entry_id BIGINT,
    order_id BIGINT,
    source_order_id BIGINT,
    status VARCHAR(32) NOT NULL,
    message VARCHAR(1024),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_allocation_quantity CHECK (released_quantity > 0),
    CONSTRAINT chk_waitlist_allocation_status CHECK (status IN (
        'PROCESSING', 'FAILED', 'OFFERED', 'NO_MATCH', 'DUPLICATE'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_allocation_event_attempt
    ON waitlist_allocation_log(event_key, attempt_no);

CREATE INDEX IF NOT EXISTS idx_waitlist_allocation_event
    ON waitlist_allocation_log(event_key, create_time);
