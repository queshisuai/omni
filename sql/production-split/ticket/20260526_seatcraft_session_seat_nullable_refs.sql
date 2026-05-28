-- owner: java-ticket
ALTER TABLE session_seat ALTER COLUMN area_id DROP NOT NULL;
ALTER TABLE session_seat ALTER COLUMN venue_seat_id DROP NOT NULL;
