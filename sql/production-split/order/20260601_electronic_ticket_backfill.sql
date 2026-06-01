-- owner: java-order
-- Backfill electronic tickets for paid orders that existed before the ticket wallet feature.

WITH paid_orders AS (
    SELECT o.*
    FROM "order" o
    WHERE o.status = 2
      AND o.user_id IS NOT NULL
      AND o.session_id IS NOT NULL
      AND o.ticket_type_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM electronic_ticket et
          WHERE et.order_id = o.id
      )
),
attendees AS (
    SELECT
        oa.*,
        ROW_NUMBER() OVER (PARTITION BY oa.order_id ORDER BY oa.id) AS rn
    FROM order_attendee oa
    WHERE oa.status = 1
),
seats AS (
    SELECT
        os.*,
        ROW_NUMBER() OVER (PARTITION BY os.order_id ORDER BY os.id) AS rn
    FROM order_seat os
    WHERE os.status = 2
),
ticket_rows AS (
    SELECT
        po.id AS order_id,
        generate_series(1, GREATEST(COALESCE(po.quantity, 1), 1)) AS rn
    FROM paid_orders po
)
INSERT INTO electronic_ticket (
    ticket_no,
    order_id,
    order_seat_id,
    user_id,
    original_user_id,
    session_id,
    ticket_type_id,
    attendee_user_profile_id,
    real_name,
    id_type,
    id_no_mask,
    phone,
    seat_label,
    status,
    create_time,
    update_time
)
SELECT
    'ET' || tr.order_id || LPAD(tr.rn::TEXT, 3, '0') AS ticket_no,
    po.id AS order_id,
    s.id AS order_seat_id,
    po.user_id,
    po.user_id AS original_user_id,
    po.session_id,
    po.ticket_type_id,
    a.attendee_user_profile_id,
    a.real_name,
    a.id_type,
    a.id_no_mask,
    a.phone,
    s.seat_label,
    1 AS status,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM ticket_rows tr
JOIN paid_orders po ON po.id = tr.order_id
LEFT JOIN attendees a ON a.order_id = tr.order_id AND a.rn = tr.rn
LEFT JOIN seats s ON s.order_id = tr.order_id AND s.rn = tr.rn
ON CONFLICT (ticket_no) DO NOTHING;
