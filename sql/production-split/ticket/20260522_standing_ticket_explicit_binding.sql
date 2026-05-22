-- owner: java-ticket

ALTER TABLE ticket_type
    ADD COLUMN IF NOT EXISTS seat_block_id BIGINT,
    ADD COLUMN IF NOT EXISTS ticket_group_key VARCHAR(120);

UPDATE ticket_type tt
SET seat_block_id = matched.seat_block_id,
    ticket_group_key = matched.ticket_group_key
FROM (
    SELECT DISTINCT ON (tt_inner.id)
        tt_inner.id AS ticket_type_id,
        sb.id AS seat_block_id,
        sb.ticket_group_key
    FROM ticket_type tt_inner
    JOIN session s ON s.id = tt_inner.session_id
    JOIN seat_block sb
        ON sb.owner_type = 'session'
       AND sb.owner_id = s.id
       AND sb.block_type = 'standingBlock'
       AND sb.status = 1
       AND sb.capacity = tt_inner.total_stock
    LEFT JOIN session_seat ss
        ON ss.session_id = tt_inner.session_id
       AND ss.ticket_type_id = tt_inner.id
    WHERE tt_inner.seat_block_id IS NULL
      AND ss.id IS NULL
    ORDER BY tt_inner.id, sb.id
) matched
WHERE tt.id = matched.ticket_type_id;

CREATE INDEX IF NOT EXISTS idx_ticket_type_seat_block ON ticket_type(seat_block_id);
CREATE INDEX IF NOT EXISTS idx_ticket_type_ticket_group_key ON ticket_type(ticket_group_key);
