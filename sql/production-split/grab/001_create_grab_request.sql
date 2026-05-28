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
    order_id bigint,
    fail_reason varchar(512),
    expire_time timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_grab_request_request_id unique (request_id),
    constraint uk_grab_request_user_idempotency unique (user_id, idempotency_key),
    constraint chk_grab_request_quantity_positive check (quantity > 0),
    constraint chk_grab_request_status check (status in (
        'PENDING',
        'ACCEPTED',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ))
);

create index if not exists idx_grab_request_status_expire_time
    on grab_request (status, expire_time);

create index if not exists idx_grab_request_user_created_at
    on grab_request (user_id, created_at desc);
