-- owner: java-order
alter table order_snapshot
    add column if not exists grab_request_id varchar(64),
    add column if not exists requested_ticket_type_id bigint,
    add column if not exists matched_ticket_type_id bigint,
    add column if not exists auto_downgraded boolean not null default false;

create index if not exists idx_order_snapshot_grab_request_id
    on order_snapshot(grab_request_id);
