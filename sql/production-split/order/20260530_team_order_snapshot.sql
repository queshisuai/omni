-- owner: java-order
alter table order_snapshot
    add column if not exists team_id bigint,
    add column if not exists team_grab_request_id varchar(64),
    add column if not exists team_order boolean not null default false;

alter table order_seat
    add column if not exists seat_label varchar(128);

create index if not exists idx_order_snapshot_team_id
    on order_snapshot(team_id)
    where team_id is not null;
