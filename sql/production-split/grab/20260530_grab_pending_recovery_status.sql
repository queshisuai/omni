-- owner: grab-service
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
        'PENDING_RECOVERY',
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
        'PENDING_RECOVERY',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ));
