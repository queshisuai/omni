-- owner: java-order
-- Phase D: order-owned display snapshots for microservice decoupling.

CREATE TABLE IF NOT EXISTS order_snapshot (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    activity_id BIGINT,
    activity_name VARCHAR(255),
    activity_poster VARCHAR(500),
    tour_id BIGINT,
    station_id BIGINT,
    session_id BIGINT,
    session_time TIMESTAMP,
    venue_name VARCHAR(255),
    ticket_type_id BIGINT,
    ticket_name VARCHAR(255),
    unit_price NUMERIC(10, 2),
    quantity INTEGER,
    seat_labels TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_snapshot(session_id);

INSERT INTO order_snapshot (
    order_id,
    activity_id,
    activity_name,
    activity_poster,
    tour_id,
    station_id,
    session_id,
    session_time,
    venue_name,
    ticket_type_id,
    ticket_name,
    unit_price,
    quantity,
    seat_labels,
    create_time,
    update_time
)
SELECT
    o.id AS order_id,
    a.id AS activity_id,
    a.name AS activity_name,
    a.poster AS activity_poster,
    a.tour_id AS tour_id,
    a.station_id AS station_id,
    o.session_id AS session_id,
    s.start_time AS session_time,
    v.name AS venue_name,
    o.ticket_type_id AS ticket_type_id,
    tt.name AS ticket_name,
    COALESCE(tt.price, CASE WHEN o.quantity IS NOT NULL AND o.quantity > 0 THEN o.amount / o.quantity ELSE NULL END) AS unit_price,
    o.quantity AS quantity,
    seat_snapshot.seat_labels AS seat_labels,
    CURRENT_TIMESTAMP AS create_time,
    CURRENT_TIMESTAMP AS update_time
FROM "order" o
LEFT JOIN session s ON s.id = o.session_id
LEFT JOIN activity a ON a.id = s.activity_id
LEFT JOIN venue v ON v.id = s.venue_id
LEFT JOIN ticket_type tt ON tt.id = o.ticket_type_id
LEFT JOIN (
    SELECT
        os.order_id,
        STRING_AGG(COALESCE(ss.seat_label, ss.row_no::TEXT || '-' || ss.seat_no::TEXT), ', ' ORDER BY os.id) AS seat_labels
    FROM order_seat os
    LEFT JOIN session_seat ss ON ss.id = os.session_seat_id
    GROUP BY os.order_id
) seat_snapshot ON seat_snapshot.order_id = o.id
ON CONFLICT (order_id) DO UPDATE SET
    activity_id = EXCLUDED.activity_id,
    activity_name = EXCLUDED.activity_name,
    activity_poster = EXCLUDED.activity_poster,
    tour_id = EXCLUDED.tour_id,
    station_id = EXCLUDED.station_id,
    session_id = EXCLUDED.session_id,
    session_time = EXCLUDED.session_time,
    venue_name = EXCLUDED.venue_name,
    ticket_type_id = EXCLUDED.ticket_type_id,
    ticket_name = EXCLUDED.ticket_name,
    unit_price = EXCLUDED.unit_price,
    quantity = EXCLUDED.quantity,
    seat_labels = EXCLUDED.seat_labels,
    update_time = CURRENT_TIMESTAMP;
