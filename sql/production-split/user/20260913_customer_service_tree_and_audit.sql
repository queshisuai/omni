-- owner: java-user

ALTER TABLE support_conversation
    ADD COLUMN IF NOT EXISTS skill_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS sla_timeout_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS cs_skill_group (
    id BIGSERIAL PRIMARY KEY,
    group_code VARCHAR(64) UNIQUE NOT NULL,
    group_name VARCHAR(128) NOT NULL,
    leader_user_id BIGINT,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cs_agent_member (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES cs_skill_group(id),
    user_id BIGINT NOT NULL,
    agent_name VARCHAR(64) NOT NULL,
    agent_status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cs_agent_member_status CHECK (agent_status IN (0, 1, 2)),
    CONSTRAINT uk_cs_agent_member_group_user UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS cs_session_audit (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES support_conversation(id),
    auditor_user_id BIGINT NOT NULL,
    score INT NOT NULL,
    comments TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cs_session_audit_score CHECK (score BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_support_conversation_skill_group_status
    ON support_conversation(skill_group_id, status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversation_sla_timeout
    ON support_conversation(sla_timeout_flag, status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_cs_agent_member_group_status
    ON cs_agent_member(group_id, agent_status, user_id);
CREATE INDEX IF NOT EXISTS idx_cs_session_audit_session_time
    ON cs_session_audit(session_id, create_time DESC, id DESC);

INSERT INTO cs_skill_group (group_code, group_name, status)
VALUES
    ('AI_DISPATCH', 'AI 分流中心', 1),
    ('TICKET_REFUND', '票务退改与咨询组', 1),
    ('DISPUTE_COMPLAINT', '演出纠纷与客诉二线组', 1)
ON CONFLICT (group_code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_permission (code, name, description)
VALUES
    ('cs.manage', '客服工作台管理', '客服技能组、转接、升级和质检写入'),
    ('cs.review', '客服质检查看', '查看客服待质检会话和质检记录')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;
