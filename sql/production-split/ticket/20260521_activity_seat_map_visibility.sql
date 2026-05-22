-- owner: java-ticket

ALTER TABLE activity ADD COLUMN IF NOT EXISTS seat_map_visibility VARCHAR(20) NOT NULL DEFAULT 'hidden';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_activity_seat_map_visibility'
          AND conrelid = 'activity'::regclass
    ) THEN
        ALTER TABLE activity ADD CONSTRAINT chk_activity_seat_map_visibility CHECK (seat_map_visibility IN ('published', 'hidden'));
    END IF;
END $$;
