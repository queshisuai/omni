-- owner: java-user

CREATE TABLE IF NOT EXISTS organizer_ops_assignment (
    organizer_user_id BIGINT PRIMARY KEY,
    assigned_operator_id BIGINT,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'normal',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    next_follow_at TIMESTAMP,
    last_follow_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizer_ops_follow_up (
    id BIGSERIAL PRIMARY KEY,
    organizer_user_id BIGINT NOT NULL,
    operator_id BIGINT NOT NULL,
    follow_type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    next_follow_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizer_ops_assignment_operator
    ON organizer_ops_assignment (assigned_operator_id);

CREATE INDEX IF NOT EXISTS idx_organizer_ops_assignment_next_follow
    ON organizer_ops_assignment (next_follow_at);

CREATE INDEX IF NOT EXISTS idx_organizer_ops_follow_up_organizer_time
    ON organizer_ops_follow_up (organizer_user_id, create_time DESC, id DESC);

INSERT INTO rbac_permission (code, name, description) VALUES
    ('organizer.follow.manage', '主办方跟进管理', '维护主办方跟进记录、风险等级和下次跟进时间'),
    ('organizer.assign.manage', '主办方分配管理', '分配主办方给平台主办方运营员')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer_admin', 'organizer.follow.manage'),
    ('organizer_admin', 'organizer.assign.manage')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code
FROM rbac_permission
WHERE code IN ('organizer.follow.manage', 'organizer.assign.manage')
ON CONFLICT DO NOTHING;
