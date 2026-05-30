-- owner: java-order
alter table order_snapshot
    add column if not exists seat_selection_mode varchar(32);
