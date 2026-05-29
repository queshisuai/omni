-- owner: grab-service
create table if not exists grab_request (
    id bigserial primary key,
    request_id varchar(64) not null,
    idempotency_key varchar(128) not null,
    user_id bigint not null,
    session_id bigint not null,
    ticket_type_id bigint not null,
    quantity integer not null,
    seat_ids jsonb not null default '[]'::jsonb,
    allocate_random boolean not null default false,
    status varchar(32) not null,
    request_type varchar(32) not null default 'NORMAL_GRAB',
    queue_seq bigint,
    requested_ticket_types jsonb not null default '[]'::jsonb,
    allow_auto_downgrade boolean not null default false,
    current_ticket_type_id bigint,
    current_attempt_index integer not null default 0,
    matched_ticket_type_id bigint,
    progress_status varchar(32) not null default 'QUEUED',
    progress_message varchar(512),
    attempts_snapshot jsonb not null default '[]'::jsonb,
    order_id bigint,
    fail_reason varchar(512),
    worker_claimed_at timestamptz,
    worker_id varchar(128),
    processing_started_at timestamptz,
    completed_at timestamptz,
    expire_time timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_grab_request_request_id unique (request_id),
    constraint uk_grab_request_user_idempotency unique (user_id, idempotency_key),
    constraint chk_grab_request_quantity_positive check (quantity > 0),
    constraint chk_grab_request_status check (status in (
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
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ))
);

create index if not exists idx_grab_request_status_expire_time
    on grab_request (status, expire_time);

create index if not exists idx_grab_request_user_created_at
    on grab_request (user_id, created_at desc);

create index if not exists idx_grab_request_session_queue_seq
    on grab_request (session_id, queue_seq);

create index if not exists idx_grab_request_progress_expire_time
    on grab_request (progress_status, expire_time);
