-- Cleanup manual API verification data created during SeatCraft redesign.
-- Keep this script narrow: it only removes explicitly named test venues.

DELETE FROM venue_default_layout_section
WHERE layout_id IN (
    SELECT id FROM venue_default_layout WHERE venue_id IN (
        SELECT id FROM venue WHERE id = 16 OR name IN ('测试场馆', '__TEST__测试场馆') OR name LIKE '__TEST__%'
    )
);

DELETE FROM venue_default_layout
WHERE venue_id IN (
    SELECT id FROM venue WHERE id = 16 OR name IN ('测试场馆', '__TEST__测试场馆') OR name LIKE '__TEST__%'
);

DELETE FROM venue
WHERE id = 16 OR name IN ('测试场馆', '__TEST__测试场馆') OR name LIKE '__TEST__%';
