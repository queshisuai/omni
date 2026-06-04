-- owner: java-user

CREATE TABLE IF NOT EXISTS rbac_role (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rbac_permission (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rbac_role_permission (
    role_code VARCHAR(64) NOT NULL REFERENCES rbac_role(code),
    permission_code VARCHAR(64) NOT NULL REFERENCES rbac_permission(code),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, permission_code)
);

ALTER TABLE support_account
    ADD COLUMN IF NOT EXISTS support_role VARCHAR(32) NOT NULL DEFAULT 'support_agent';

UPDATE support_account SET support_role = 'support_agent' WHERE support_role IS NULL;

INSERT INTO rbac_role (code, name) VALUES
    ('platform_super_admin', '平台超管'),
    ('support_manager', '客服主管'),
    ('support_agent', '普通客服'),
    ('organizer', '主办方'),
    ('organizer_admin', '主办方管理员')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_permission (code, name) VALUES
    ('support.account.manage', '客服账号管理'),
    ('support.conversation.view', '客服会话查询'),
    ('refund.review', '退款审核'),
    ('station.review', '站点变更审核'),
    ('venue.review', '场馆资料审核'),
    ('venue.manage', '场馆管理'),
    ('risk.review', '风险审核'),
    ('risk.view', '风险查看'),
    ('organizer.review', '主办方管理'),
    ('organizer.account.manage', '主办方账号管理'),
    ('rbac.manage', '角色权限管理'),
    ('activity.manage', '活动管理'),
    ('tour.manage', '巡演管理'),
    ('session.manage', '场次管理'),
    ('artist.manage', '艺人管理'),
    ('order.view', '订单查看'),
    ('audit.view', '审计查看'),
    ('reconcile.view', '对账查看'),
    ('compensation.execute', '异常补偿执行')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code FROM rbac_permission
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('support_manager', 'support.account.manage'),
    ('support_manager', 'support.conversation.view'),
    ('support_manager', 'audit.view')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('support_agent', 'support.conversation.view')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer', 'activity.manage'),
    ('organizer', 'tour.manage'),
    ('organizer', 'session.manage'),
    ('organizer', 'artist.manage'),
    ('organizer', 'order.view'),
    ('organizer', 'refund.review'),
    ('organizer', 'venue.manage'),
    ('organizer', 'risk.view')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer_admin', 'activity.manage'),
    ('organizer_admin', 'tour.manage'),
    ('organizer_admin', 'session.manage'),
    ('organizer_admin', 'artist.manage'),
    ('organizer_admin', 'order.view'),
    ('organizer_admin', 'refund.review'),
    ('organizer_admin', 'venue.manage'),
    ('organizer_admin', 'organizer.review'),
    ('organizer_admin', 'organizer.account.manage'),
    ('organizer_admin', 'venue.review'),
    ('organizer_admin', 'audit.view')
ON CONFLICT DO NOTHING;

-- 创建职位对应账号（密码均为 123456，仅用于开发/测试环境）
INSERT INTO "user" (role, phone, nickname, password, status) VALUES
    ('admin', '13910000001', '平台超管', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO "user" (role, phone, nickname, password, status) VALUES
    ('support', '13910000002', '客服主管', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1),
    ('support', '13910000003', '普通客服', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO "user" (role, phone, nickname, password, status) VALUES
    ('organizer_admin', '13910000004', '主办方管理员', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1)
ON CONFLICT (phone) DO NOTHING;

UPDATE "user"
SET role = 'organizer_admin', update_time = CURRENT_TIMESTAMP
WHERE phone = '13910000004' AND role = 'organizer';

DELETE FROM support_account
WHERE phone = '13900000002' AND support_role = 'support_manager';

UPDATE "user"
SET role = 'user', nickname = '观演用户小夏', update_time = CURRENT_TIMESTAMP
WHERE phone = '13900000002' AND role = 'support';

INSERT INTO support_account (user_id, phone, nickname, status, support_role)
SELECT u.id, u.phone, u.nickname, 1, 'support_manager'
FROM "user" u
WHERE u.phone = '13910000002'
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, nickname = EXCLUDED.nickname, status = EXCLUDED.status, support_role = 'support_manager';

INSERT INTO support_account (user_id, phone, nickname, status, support_role)
SELECT u.id, u.phone, u.nickname, 1, 'support_agent'
FROM "user" u
WHERE u.phone = '13910000003'
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, nickname = EXCLUDED.nickname, status = EXCLUDED.status, support_role = 'support_agent';
