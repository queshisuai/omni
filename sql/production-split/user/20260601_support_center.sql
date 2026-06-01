-- owner: java-user

CREATE TABLE IF NOT EXISTS support_conversation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    subject VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    source_type VARCHAR(16) NOT NULL DEFAULT 'AI',
    assigned_agent_id BIGINT REFERENCES "user"(id),
    last_message TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    CONSTRAINT chk_support_conversation_status CHECK (status IN ('OPEN', 'WAITING_AGENT', 'ASSIGNED', 'CLOSED')),
    CONSTRAINT chk_support_conversation_source CHECK (source_type IN ('AI', 'HUMAN'))
);

CREATE TABLE IF NOT EXISTS support_message (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    sender_user_id BIGINT REFERENCES "user"(id),
    sender_type VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_message_sender CHECK (sender_type IN ('USER', 'AI', 'AGENT', 'SYSTEM'))
);

CREATE INDEX IF NOT EXISTS idx_support_conversation_user_time
    ON support_conversation(user_id, update_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversation_agent_status
    ON support_conversation(assigned_agent_id, status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversation_status_time
    ON support_conversation(status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_support_message_conversation_time
    ON support_message(conversation_id, id ASC);
