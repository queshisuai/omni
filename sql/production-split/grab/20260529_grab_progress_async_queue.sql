-- owner: grab-service
alter table grab_request
    add column if not exists request_type varchar(32) not null default 'NORMAL_GRAB',
    add column if not exists queue_seq bigint,
    add column if not exists requested_ticket_types jsonb not null default '[]'::jsonb,
    add column if not exists allow_auto_downgrade boolean not null default false,
    add column if not exists current_ticket_type_id bigint,
    add column if not exists current_attempt_index integer not null default 0,
    add column if not exists matched_ticket_type_id bigint,
    add column if not exists progress_status varchar(32),
    add column if not exists progress_message varchar(512),
    add column if not exists attempts_snapshot jsonb not null default '[]'::jsonb,
    add column if not exists worker_claimed_at timestamptz,
    add column if not exists worker_id varchar(128),
    add column if not exists processing_started_at timestamptz,
    add column if not exists completed_at timestamptz;

update grab_request
set progress_status = case status
    when 'PENDING' then 'QUEUED'
    when 'ACCEPTED' then 'WAITING'
    when 'QUEUED' then 'QUEUED'
    when 'WAITING' then 'WAITING'
    when 'TRYING_TICKET_TYPE' then 'TRYING_TICKET_TYPE'
    when 'LOCKING' then 'LOCKING'
    when 'ORDER_CREATING' then 'ORDER_CREATING'
    when 'ORDER_CREATED' then 'ORDER_CREATED'
    when 'SOLD_OUT' then 'SOLD_OUT'
    when 'DOWNGRADING' then 'DOWNGRADING'
    when 'LIMITED' then 'LIMITED'
    when 'FAILED' then 'FAILED'
    when 'EXPIRED' then 'EXPIRED'
    else 'QUEUED'
end
where progress_status is null
   or (queue_seq is null and progress_status = 'QUEUED' and status <> 'QUEUED');

alter table grab_request
    alter column progress_status set default 'QUEUED',
    alter column progress_status set not null;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conname = 'chk_grab_request_status'
          and conrelid = 'grab_request'::regclass
    ) then
        alter table grab_request drop constraint chk_grab_request_status;
    end if;

    if exists (
        select 1
        from pg_constraint
        where conname = 'chk_grab_request_progress_status'
          and conrelid = 'grab_request'::regclass
    ) then
        alter table grab_request drop constraint chk_grab_request_progress_status;
    end if;
end $$;

alter table grab_request
    add constraint chk_grab_request_status check (status in (
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
    )),
    add constraint chk_grab_request_progress_status check (progress_status in (
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ));

create index if not exists idx_grab_request_session_queue_seq
    on grab_request (session_id, queue_seq);

create index if not exists idx_grab_request_progress_expire_time
    on grab_request (progress_status, expire_time);
