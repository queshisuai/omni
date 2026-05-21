-- owner: java-ticket

INSERT INTO venue_default_layout (venue_id, name, template_type, stage_title, stage_x, stage_y, canvas_width, canvas_height, status)
SELECT v.id, v.name || ' SeatCraft 座位图', 'concert', '舞台', 80, 40, 960, 720, 1
FROM venue v
LEFT JOIN venue_default_layout existing ON existing.venue_id = v.id AND existing.status = 1
WHERE existing.id IS NULL
AND EXISTS (
    SELECT 1 FROM venue_area va
    WHERE va.venue_id = v.id AND va.status = 1
);

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, source_block_ids, sort, status)
SELECT 'venue', va.venue_id, 'area-' || va.id, va.name, 'area-' || va.id, va.sort, 1
FROM venue_area va
LEFT JOIN ticket_group existing ON existing.owner_type = 'venue'
    AND existing.owner_id = va.venue_id
    AND existing.group_key = 'area-' || va.id
    AND existing.status = 1
WHERE va.status = 1
AND existing.id IS NULL;

INSERT INTO seat_block (owner_type, owner_id, block_key, name, block_type, ticket_group_key, x, y, rows, cols, row_spacing, seat_spacing, color, sort, status)
SELECT
    'venue',
    va.venue_id,
    'area-' || va.id,
    va.name,
    'gridBlock',
    'area-' || va.id,
    120 + (va.sort - 1) * 240,
    180,
    va.row_count,
    va.seats_per_row,
    20,
    18,
    COALESCE(va.color, '#ff1268'),
    va.sort,
    1
FROM venue_area va
LEFT JOIN seat_block existing ON existing.owner_type = 'venue'
    AND existing.owner_id = va.venue_id
    AND existing.block_key = 'area-' || va.id
    AND existing.status = 1
WHERE va.status = 1
AND existing.id IS NULL;

INSERT INTO session_seat_layout (session_id, name, template_type, stage_title, stage_x, stage_y, canvas_width, canvas_height, status)
SELECT s.id, a.name || ' 场次座位图', 'concert', '舞台', 80, 40, 960, 720, 1
FROM session s
JOIN activity a ON a.id = s.activity_id
LEFT JOIN session_seat_layout existing ON existing.session_id = s.id AND existing.status = 1
WHERE existing.id IS NULL
AND EXISTS (
    SELECT 1 FROM ticket_type_area tta
    WHERE tta.session_id = s.id
);

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, source_block_ids, sort, status)
SELECT 'session', tta.session_id, 'area-' || tta.area_id, tt.name, 'area-' || tta.area_id, va.sort, 1
FROM ticket_type_area tta
JOIN ticket_type tt ON tt.id = tta.ticket_type_id
JOIN venue_area va ON va.id = tta.area_id
LEFT JOIN ticket_group existing ON existing.owner_type = 'session'
    AND existing.owner_id = tta.session_id
    AND existing.group_key = 'area-' || tta.area_id
    AND existing.status = 1
WHERE existing.id IS NULL;

INSERT INTO seat_block (owner_type, owner_id, block_key, name, block_type, ticket_group_key, x, y, rows, cols, row_spacing, seat_spacing, color, sort, status)
SELECT
    'session',
    tta.session_id,
    'area-' || va.id,
    va.name,
    'gridBlock',
    'area-' || va.id,
    120 + (va.sort - 1) * 240,
    180,
    va.row_count,
    va.seats_per_row,
    20,
    18,
    COALESCE(va.color, '#ff1268'),
    va.sort,
    1
FROM ticket_type_area tta
JOIN venue_area va ON va.id = tta.area_id
LEFT JOIN seat_block existing ON existing.owner_type = 'session'
    AND existing.owner_id = tta.session_id
    AND existing.block_key = 'area-' || va.id
    AND existing.status = 1
WHERE existing.id IS NULL;

INSERT INTO session_seat_layout_section (session_layout_id, ticket_type_id, section_key, name, rows, cols, x, y, color, type, layout, seat_count, sort, status)
SELECT
    ssl.id,
    tt.id,
    'area-' || va.id,
    va.name,
    va.row_count,
    va.seats_per_row,
    120 + (va.sort - 1) * 240,
    180,
    COALESCE(va.color, '#ff1268'),
    'core',
    'grid',
    va.row_count * va.seats_per_row,
    va.sort,
    1
FROM ticket_type_area tta
JOIN ticket_type tt ON tt.id = tta.ticket_type_id
JOIN venue_area va ON va.id = tta.area_id
JOIN session_seat_layout ssl ON ssl.session_id = tta.session_id AND ssl.status = 1
LEFT JOIN session_seat_layout_section existing ON existing.session_layout_id = ssl.id
    AND existing.ticket_type_id = tt.id
    AND existing.section_key = 'area-' || va.id
    AND existing.status = 1
WHERE existing.id IS NULL;

UPDATE session_seat ss
SET ticket_type_id = tta.ticket_type_id,
    layout_section_id = ssls.id,
    seat_block_id = sb.id,
    ticket_group_key = 'area-' || ss.area_id,
    generated_row_no = ss.row_no,
    generated_seat_no = ss.seat_no,
    update_time = CURRENT_TIMESTAMP
FROM ticket_type_area tta
JOIN session_seat_layout ssl ON ssl.session_id = tta.session_id AND ssl.status = 1
JOIN session_seat_layout_section ssls ON ssls.session_layout_id = ssl.id AND ssls.ticket_type_id = tta.ticket_type_id AND ssls.status = 1
JOIN seat_block sb ON sb.owner_type = 'session' AND sb.owner_id = tta.session_id AND sb.block_key = 'area-' || tta.area_id AND sb.status = 1
WHERE ss.session_id = tta.session_id
  AND ss.area_id = tta.area_id
  AND (ss.layout_section_id IS NULL OR ss.seat_block_id IS NULL OR ss.ticket_group_key IS NULL OR ss.ticket_type_id IS NULL);
