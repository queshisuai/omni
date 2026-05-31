-- owner: grab-service

ALTER TABLE grab_request
    ADD COLUMN IF NOT EXISTS attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
