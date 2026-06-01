-- owner: java-user

ALTER TABLE support_conversation
    DROP CONSTRAINT IF EXISTS chk_support_conversation_status;

ALTER TABLE support_conversation
    ADD CONSTRAINT chk_support_conversation_status
    CHECK (status IN ('OPEN', 'WAITING_AGENT', 'ASSIGNED', 'CLOSE_REQUESTED', 'CLOSED'));
