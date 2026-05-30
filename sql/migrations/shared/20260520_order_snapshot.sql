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
    seat_selection_mode VARCHAR(32),
    grab_request_id VARCHAR(64),
    requested_ticket_type_id BIGINT,
    matched_ticket_type_id BIGINT,
    auto_downgraded BOOLEAN NOT NULL DEFAULT FALSE,
    team_id BIGINT,
    team_grab_request_id VARCHAR(64),
    team_order BOOLEAN NOT NULL DEFAULT FALSE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE
);

ALTER TABLE IF EXISTS order_snapshot
    ADD COLUMN IF NOT EXISTS grab_request_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS seat_selection_mode VARCHAR(32),
    ADD COLUMN IF NOT EXISTS requested_ticket_type_id BIGINT,
    ADD COLUMN IF NOT EXISTS matched_ticket_type_id BIGINT,
    ADD COLUMN IF NOT EXISTS auto_downgraded BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS team_id BIGINT,
    ADD COLUMN IF NOT EXISTS team_grab_request_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS team_order BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS order_seat
    ADD COLUMN IF NOT EXISTS seat_label VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_snapshot(session_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_grab_request_id ON order_snapshot(grab_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_order_snapshot_grab_request_id
    ON order_snapshot(grab_request_id)
    WHERE grab_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_snapshot_team_id
    ON order_snapshot(team_id)
    WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_order_snapshot_team_grab_request
    ON order_snapshot(team_grab_request_id)
    WHERE team_order = TRUE AND team_grab_request_id IS NOT NULL;

WITH order_snapshot_source AS (
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
        COALESCE(seat_snapshot.has_order_seats, FALSE) AS has_order_seats,
        FALSE AS team_order
    FROM "order" o
    LEFT JOIN session s ON s.id = o.session_id
    LEFT JOIN activity a ON a.id = s.activity_id
    LEFT JOIN venue v ON v.id = s.venue_id
    LEFT JOIN ticket_type tt ON tt.id = o.ticket_type_id
    LEFT JOIN (
        SELECT
            os.order_id,
            STRING_AGG(os.seat_label, ', ' ORDER BY os.id) AS seat_labels,
            TRUE AS has_order_seats
        FROM order_seat os
        GROUP BY os.order_id
    ) seat_snapshot ON seat_snapshot.order_id = o.id
)
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
    seat_selection_mode,
    team_order,
    create_time,
    update_time
)
SELECT
    source.order_id,
    source.activity_id,
    source.activity_name,
    source.activity_poster,
    source.tour_id,
    source.station_id,
    source.session_id,
    source.session_time,
    source.venue_name,
    source.ticket_type_id,
    source.ticket_name,
    source.unit_price,
    source.quantity,
    source.seat_labels,
    CASE
        WHEN COALESCE(source.team_order, FALSE) = TRUE THEN 'TEAM'
        WHEN source.has_order_seats THEN 'EXPLICIT'
        ELSE 'NONE'
    END AS seat_selection_mode,
    source.team_order,
    CURRENT_TIMESTAMP AS create_time,
    CURRENT_TIMESTAMP AS update_time
FROM order_snapshot_source source
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
    seat_selection_mode = COALESCE(
        order_snapshot.seat_selection_mode,
        CASE
            WHEN COALESCE(order_snapshot.team_order, EXCLUDED.team_order, FALSE) = TRUE THEN 'TEAM'
            WHEN EXISTS (
                SELECT 1
                FROM order_seat oseat
                WHERE oseat.order_id = order_snapshot.order_id
            ) THEN 'EXPLICIT'
            ELSE EXCLUDED.seat_selection_mode
        END
    ),
    update_time = CURRENT_TIMESTAMP;

UPDATE order_snapshot os
SET seat_selection_mode = CASE
    WHEN COALESCE(os.team_order, FALSE) = TRUE THEN 'TEAM'
    WHEN EXISTS (
        SELECT 1
        FROM order_seat oseat
        WHERE oseat.order_id = os.order_id
    ) THEN 'EXPLICIT'
    ELSE 'NONE'
END
WHERE os.seat_selection_mode IS NULL;
