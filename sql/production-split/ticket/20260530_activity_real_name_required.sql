-- owner: java-ticket

ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS real_name_required BOOLEAN NOT NULL DEFAULT FALSE;
