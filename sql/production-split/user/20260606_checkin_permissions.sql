-- owner: java-user

INSERT INTO rbac_permission (code, name, description) VALUES
    ('checkin.view', '入场核验查看', '查看入场概览和核验记录'),
    ('checkin.sync', '备用核验执行', '执行备用 Web 扫码核验和异常补录'),
    ('checkin.device.manage', '核验设备管理', '管理线下核验设备')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer', 'checkin.view'),
    ('organizer_admin', 'checkin.view'),
    ('organizer_admin', 'checkin.device.manage')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code
FROM rbac_permission
WHERE code IN ('checkin.view', 'checkin.sync', 'checkin.device.manage')
ON CONFLICT DO NOTHING;
