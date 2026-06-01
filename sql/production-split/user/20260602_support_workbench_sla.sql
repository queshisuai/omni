-- owner: java-user

ALTER TABLE support_conversation
    ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS first_agent_replied_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_agent_message_at TIMESTAMP;

UPDATE support_conversation c
SET first_response_due_at = COALESCE(first_response_due_at, c.create_time + INTERVAL '5 minutes')
WHERE c.source_type = 'HUMAN'
  AND c.status IN ('WAITING_AGENT', 'ASSIGNED', 'CLOSE_REQUESTED');

UPDATE support_conversation c
SET last_user_message_at = m.last_user_message_at
FROM (
    SELECT conversation_id, MAX(create_time) AS last_user_message_at
    FROM support_message
    WHERE sender_type = 'USER'
    GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id
  AND c.last_user_message_at IS NULL;

UPDATE support_conversation c
SET last_agent_message_at = m.last_agent_message_at,
    first_agent_replied_at = COALESCE(c.first_agent_replied_at, m.first_agent_replied_at)
FROM (
    SELECT
        conversation_id,
        MIN(create_time) AS first_agent_replied_at,
        MAX(create_time) AS last_agent_message_at
    FROM support_message
    WHERE sender_type = 'AGENT'
    GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id;

CREATE INDEX IF NOT EXISTS idx_support_conversation_sla_due
    ON support_conversation(status, first_response_due_at, update_time DESC);

CREATE INDEX IF NOT EXISTS idx_support_conversation_last_user_message
    ON support_conversation(status, last_user_message_at DESC);
