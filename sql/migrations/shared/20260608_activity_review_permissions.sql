-- owner: java-user

INSERT INTO rbac_permission (code, name, description) VALUES
    ('activity.review.manage', '评价问答管理', '审核活动评价、处理评价举报并维护购前问答')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer_admin', 'activity.review.manage')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code
FROM rbac_permission
WHERE code = 'activity.review.manage'
ON CONFLICT DO NOTHING;
