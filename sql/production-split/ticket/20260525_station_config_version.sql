-- owner: java-ticket

ALTER TABLE station
    ADD COLUMN IF NOT EXISTS activity_id BIGINT;

ALTER TABLE station ALTER COLUMN tour_id DROP NOT NULL;
ALTER TABLE station ALTER COLUMN city DROP NOT NULL;
ALTER TABLE station ALTER COLUMN station_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_station_activity_id ON station(activity_id);

UPDATE station s
SET activity_id = linked_activity.activity_id
FROM (
    SELECT station_id, MIN(id) AS activity_id
    FROM activity
    WHERE station_id IS NOT NULL
    GROUP BY station_id
) linked_activity
WHERE s.activity_id IS NULL
  AND linked_activity.station_id = s.id;

CREATE TABLE IF NOT EXISTS station_config_version (
    id BIGSERIAL PRIMARY KEY,
    station_id BIGINT NOT NULL,
    activity_id BIGINT,
    tour_id BIGINT,
    version_no INTEGER NOT NULL,
    change_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    city VARCHAR(100),
    station_name VARCHAR(200),
    venue_id BIGINT,
    venue_application_id BIGINT,
    venue_name VARCHAR(200),
    venue_address VARCHAR(500),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    schedule_tba BOOLEAN NOT NULL DEFAULT FALSE,
    seat_template_source_type VARCHAR(64),
    seat_template_source_id BIGINT,
    reason TEXT,
    reviewer_id BIGINT,
    review_note TEXT,
    review_time TIMESTAMP,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP,
    CONSTRAINT uk_station_config_version_no UNIQUE (station_id, version_no),
    CONSTRAINT ck_station_config_version_change_type CHECK (change_type IN (
        'create', 'update_city', 'set_venue', 'change_venue', 'set_schedule', 'change_schedule', 'delete_station'
    )),
    CONSTRAINT ck_station_config_version_status CHECK (status IN (
        'draft', 'submitted', 'approved', 'rejected', 'applied', 'withdrawn'
    ))
);

CREATE INDEX IF NOT EXISTS idx_station_config_version_station_status
    ON station_config_version(station_id, status);

CREATE INDEX IF NOT EXISTS idx_station_config_version_review
    ON station_config_version(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_station_config_version_activity
    ON station_config_version(activity_id);

CREATE INDEX IF NOT EXISTS idx_station_config_version_tour
    ON station_config_version(tour_id);

INSERT INTO station_config_version (
    station_id, activity_id, tour_id, version_no, change_type, status,
    city, station_name, venue_application_id, schedule_tba,
    created_by, created_at, updated_at, applied_at
)
SELECT
    s.id, s.activity_id, s.tour_id, 0, 'create', 'applied',
    s.city, s.station_name, s.venue_application_id, FALSE,
    -- 历史孤儿数据兜底：无法推导主办方时保留 0，避免迁移阻塞。
    COALESCE(t.organizer_id, a.organizer_id, 0),
    COALESCE(s.create_time, CURRENT_TIMESTAMP),
    COALESCE(s.update_time, CURRENT_TIMESTAMP),
    COALESCE(s.update_time, CURRENT_TIMESTAMP)
FROM station s
LEFT JOIN tour t ON t.id = s.tour_id
LEFT JOIN activity a ON a.id = s.activity_id
WHERE NOT EXISTS (
    SELECT 1
    FROM station_config_version v
    WHERE v.station_id = s.id
      AND v.change_type = 'create'
      AND v.status = 'applied'
);
