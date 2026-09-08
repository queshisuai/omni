-- owner: java-ticket
-- 将历史演示场馆的 930000+ 虚拟 ID 收拢到正常场馆 ID。
-- 同名同址记录复用已有低位场馆；没有低位对应的记录使用 venue_id_seq 生成新 ID。

BEGIN;

CREATE TEMP TABLE omni_venue_id_map (
    old_id BIGINT PRIMARY KEY,
    new_id BIGINT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO omni_venue_id_map (old_id, new_id)
VALUES
    (930001, 1),
    (930002, 3),
    (930003, 5),
    (930004, 6),
    (930005, 7),
    (930006, 8),
    (930007, 9),
    (930008, 10),
    (930009, 12),
    (930010, 11)
ON CONFLICT (old_id) DO NOTHING;

-- 先把序列回收到正常数据的最大值，再为没有同名低位记录的场馆分配新 ID。
SELECT setval(
    'venue_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM venue WHERE id < 930000), 1), 1),
    true
);

INSERT INTO omni_venue_id_map (old_id, new_id)
SELECT 930011, nextval('venue_id_seq')
WHERE EXISTS (SELECT 1 FROM venue WHERE id = 930011);

INSERT INTO omni_venue_id_map (old_id, new_id)
SELECT 930012, nextval('venue_id_seq')
WHERE EXISTS (SELECT 1 FROM venue WHERE id = 930012);

INSERT INTO venue (id, name, city, address, capacity, status, create_time)
SELECT map.new_id, old.name, old.city, old.address, old.capacity, old.status, old.create_time
FROM venue old
JOIN omni_venue_id_map map ON map.old_id = old.id
WHERE old.id IN (930011, 930012)
  AND NOT EXISTS (SELECT 1 FROM venue existing WHERE existing.id = map.new_id);

-- 已有低位场馆的默认布局具有 venue_id 唯一约束，保留低位布局并修正可能的引用。
UPDATE activity_seat_layout activity_layout
SET source_venue_layout_id = target_layout.id
FROM venue_default_layout old_layout
JOIN omni_venue_id_map map ON map.old_id = old_layout.venue_id
JOIN venue_default_layout target_layout ON target_layout.venue_id = map.new_id
WHERE activity_layout.source_venue_layout_id = old_layout.id;

DELETE FROM venue_default_layout old_layout
USING omni_venue_id_map map
WHERE old_layout.venue_id = map.old_id
  AND EXISTS (
      SELECT 1
      FROM venue_default_layout target_layout
      WHERE target_layout.venue_id = map.new_id
  );

UPDATE session target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE session_seat target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE station_config_version target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE venue_application target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE venue_area target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE venue_seat target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

UPDATE venue_default_layout target
SET venue_id = map.new_id
FROM omni_venue_id_map map
WHERE target.venue_id = map.old_id;

DELETE FROM venue
WHERE id IN (SELECT old_id FROM omni_venue_id_map);

SELECT setval(
    'venue_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM venue), 1), 1),
    true
);

COMMIT;
