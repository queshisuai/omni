-- owner: java-ticket
ALTER TABLE seat_block ADD COLUMN IF NOT EXISTS polygon_points JSONB;

ALTER TABLE seat_block DROP CONSTRAINT IF EXISTS chk_seat_block_type;
ALTER TABLE seat_block ADD CONSTRAINT chk_seat_block_type
    CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock', 'polygonBlock'));
