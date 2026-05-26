-- owner: java-ticket
-- Restore ticket_type_id on released/refunded seats that were returned to sale but lost their ticket binding.
WITH unique_block_ticket_type AS (
    SELECT session_id, seat_block_id, MIN(id) AS ticket_type_id
    FROM ticket_type
    WHERE status = 1
      AND seat_block_id IS NOT NULL
    GROUP BY session_id, seat_block_id
    HAVING COUNT(*) = 1
)
UPDATE session_seat ss
SET ticket_type_id = ubtt.ticket_type_id,
    update_time = CURRENT_TIMESTAMP
FROM unique_block_ticket_type ubtt
WHERE ss.session_id = ubtt.session_id
  AND ss.seat_block_id = ubtt.seat_block_id
  AND ss.status = 1
  AND ss.ticket_type_id IS NULL
  AND ss.seat_block_id IS NOT NULL;
