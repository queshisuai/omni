-- owner: java-ticket
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS lock_request_id varchar(64);

CREATE INDEX IF NOT EXISTS idx_session_seat_team_lock_lookup
    ON session_seat(session_id, ticket_type_id, status, layout_section_id, row_no, seat_no)
    WHERE order_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_seat_lock_request
    ON session_seat(lock_request_id)
    WHERE lock_request_id IS NOT NULL;
