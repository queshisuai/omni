-- owner: grab-service

create table if not exists ticket_team (
    id bigserial primary key,
    invite_code varchar(32) not null,
    leader_user_id bigint not null,
    activity_id bigint not null,
    session_id bigint not null,
    ticket_type_id bigint not null,
    size integer not null default 1,
    strategy varchar(32) not null default 'STRICT_CONTIGUOUS',
    fallback_strategy_json jsonb not null default '[]'::jsonb,
    status varchar(32) not null default 'DRAFT',
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    constraint uk_ticket_team_invite_code unique (invite_code),
    constraint chk_ticket_team_size check (size between 1 and 6),
    constraint chk_ticket_team_strategy check (strategy in ('STRICT_CONTIGUOUS', 'SAME_BLOCK', 'SAME_TICKET_TYPE', 'FALLBACK')),
    constraint chk_ticket_team_status check (status in ('DRAFT', 'READY', 'GRABBING', 'LOCKED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
);

create table if not exists ticket_team_member (
    id bigserial primary key,
    team_id bigint not null references ticket_team(id) on delete cascade,
    session_id bigint not null,
    user_id bigint not null,
    role varchar(16) not null,
    status varchar(16) not null,
    seat_id bigint,
    order_seat_id bigint,
    join_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    constraint uk_ticket_team_member_team_user unique (team_id, user_id),
    constraint chk_ticket_team_member_role check (role in ('LEADER', 'MEMBER')),
    constraint chk_ticket_team_member_status check (status in ('INVITED', 'JOINED', 'CONFIRMED', 'LEFT'))
);

create unique index if not exists uk_ticket_team_member_active_session
    on ticket_team_member(user_id, session_id)
    where status in ('JOINED', 'CONFIRMED');

create table if not exists team_grab_request (
    id bigserial primary key,
    request_id varchar(64) not null,
    grab_request_id varchar(64) not null,
    team_id bigint not null references ticket_team(id),
    trigger_user_id bigint not null,
    payer_user_id bigint not null,
    session_id bigint not null,
    ticket_type_id bigint not null,
    quantity integer not null,
    strategy varchar(32) not null,
    fallback_strategy_json jsonb not null default '[]'::jsonb,
    matched_strategy varchar(32),
    status varchar(32) not null default 'PENDING',
    order_id bigint,
    locked_seat_ids jsonb not null default '[]'::jsonb,
    seat_labels jsonb not null default '[]'::jsonb,
    fail_reason varchar(512),
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    constraint uk_team_grab_request_request_id unique (request_id),
    constraint uk_team_grab_request_grab_request_id unique (grab_request_id),
    constraint chk_team_grab_request_quantity check (quantity between 2 and 6),
    constraint chk_team_grab_request_status check (status in ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED', 'FAILED', 'EXPIRED'))
);

create unique index if not exists uk_team_grab_request_active_team
    on team_grab_request(team_id)
    where status in ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED');

create table if not exists team_seat_assignment (
    id bigserial primary key,
    team_id bigint not null references ticket_team(id),
    user_id bigint not null,
    order_id bigint not null,
    order_seat_id bigint not null,
    session_seat_id bigint not null,
    seat_label varchar(128),
    create_time timestamptz not null default now(),
    constraint uk_team_assignment_team_user unique (team_id, user_id),
    constraint uk_team_assignment_order_seat unique (order_seat_id)
);

create index if not exists idx_ticket_team_leader on ticket_team(leader_user_id, create_time desc);
create index if not exists idx_ticket_team_session on ticket_team(session_id, status);
create index if not exists idx_ticket_team_member_team on ticket_team_member(team_id, status, join_time);
create index if not exists idx_team_grab_request_order on team_grab_request(order_id);
create index if not exists idx_team_grab_request_grab_request on team_grab_request(grab_request_id);
