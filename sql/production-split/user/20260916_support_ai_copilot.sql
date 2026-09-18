-- owner: java-user

CREATE TABLE IF NOT EXISTS support_ai_suggestion (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    agent_id BIGINT NOT NULL REFERENCES "user"(id),
    message_cutoff BIGINT NOT NULL,
    context_digest VARCHAR(64) NOT NULL,
    suggestion_text TEXT,
    summary TEXT,
    issue_type VARCHAR(64),
    recommended_action TEXT,
    missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    model VARCHAR(128),
    prompt_version VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    edited_text TEXT,
    failure_code VARCHAR(64),
    failure_reason VARCHAR(255),
    reject_reason VARCHAR(255),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    edited_at TIMESTAMP,
    rejected_at TIMESTAMP,
    CONSTRAINT chk_support_ai_suggestion_status CHECK (
        status IN ('GENERATING', 'READY', 'ACCEPTED', 'ACCEPTED_EDITED', 'REJECTED', 'EXPIRED', 'FAILED')
    ),
    CONSTRAINT chk_support_ai_suggestion_json CHECK (
        jsonb_typeof(missing_information) = 'array'
        AND jsonb_typeof(source_evidence) = 'array'
    )
);

CREATE INDEX IF NOT EXISTS idx_support_ai_suggestion_conversation_time
    ON support_ai_suggestion(conversation_id, create_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_support_ai_suggestion_conversation_status_time
    ON support_ai_suggestion(conversation_id, status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_support_ai_suggestion_agent_status_time
    ON support_ai_suggestion(agent_id, status, create_time DESC);

INSERT INTO rbac_permission (code, name, description)
VALUES
    ('support.ai.use', '客服 AI 助手使用', '生成和处理客服 AI 建议'),
    ('support.ai.review', '客服 AI 建议复核', '复核可见客服会话中的 AI 建议')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_role_permission (role_code, permission_code)
VALUES
    ('support_agent', 'support.ai.use'),
    ('support_agent', 'support.ai.review'),
    ('support_manager', 'support.ai.use'),
    ('support_manager', 'support.ai.review')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code
FROM rbac_permission
WHERE code IN ('support.ai.use', 'support.ai.review')
ON CONFLICT DO NOTHING;
