-- owner: java-order
alter table order_snapshot
    add column if not exists seat_selection_mode varchar(32);

update order_snapshot os
set seat_selection_mode = case
    when coalesce(os.team_order, false) = true then 'TEAM'
    when exists (
        select 1
        from order_seat oseat
        where oseat.order_id = os.order_id
    ) then 'EXPLICIT'
    else 'NONE'
end
where os.seat_selection_mode is null;
