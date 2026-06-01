-- owner: java-ticket

ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS ticket_transfer_allowed BOOLEAN NOT NULL DEFAULT TRUE;
