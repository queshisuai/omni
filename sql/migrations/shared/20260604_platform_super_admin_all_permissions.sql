-- owner: java-user

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code
FROM rbac_permission
ON CONFLICT DO NOTHING;
