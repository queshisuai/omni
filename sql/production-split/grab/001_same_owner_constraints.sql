-- owner: grab-service

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_team_member_team_id_fkey') THEN
        ALTER TABLE ticket_team_member
            ADD CONSTRAINT ticket_team_member_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES ticket_team(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_grab_request_team_id_fkey') THEN
        ALTER TABLE team_grab_request
            ADD CONSTRAINT team_grab_request_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES ticket_team(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_seat_assignment_team_id_fkey') THEN
        ALTER TABLE team_seat_assignment
            ADD CONSTRAINT team_seat_assignment_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES ticket_team(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_offer_entry_id_fkey') THEN
        ALTER TABLE waitlist_offer
            ADD CONSTRAINT waitlist_offer_entry_id_fkey
            FOREIGN KEY (entry_id) REFERENCES waitlist_entry(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grab_request_status_expire_time
    ON grab_request(status, expire_time);
CREATE INDEX IF NOT EXISTS idx_grab_request_user_created_at
    ON grab_request(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grab_request_session_queue_seq
    ON grab_request(session_id, queue_seq);
CREATE INDEX IF NOT EXISTS idx_grab_request_progress_expire_time
    ON grab_request(progress_status, expire_time);
CREATE INDEX IF NOT EXISTS idx_ticket_team_leader
    ON ticket_team(leader_user_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_team_session
    ON ticket_team(session_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_team_member_team
    ON ticket_team_member(team_id, status, join_time);
CREATE INDEX IF NOT EXISTS idx_team_grab_request_order
    ON team_grab_request(order_id);
CREATE INDEX IF NOT EXISTS idx_team_grab_request_grab_request
    ON team_grab_request(grab_request_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entry_queue
    ON waitlist_entry(session_id, ticket_type_id, status, priority_no, create_time, id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entry_user
    ON waitlist_entry(user_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_entry
    ON waitlist_offer(entry_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expire
    ON waitlist_offer(status, expire_time);
CREATE INDEX IF NOT EXISTS idx_waitlist_allocation_event
    ON waitlist_allocation_log(event_key, create_time);
