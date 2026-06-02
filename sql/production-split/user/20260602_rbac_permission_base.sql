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

INSERT INTO rbac_role (code, name) VALUES
    ('platform_super_admin', '平台超管'),
    ('support_manager', '客服主管'),
    ('support_agent', '普通客服'),
    ('organizer_admin', '主办方管理员')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, update_time = CURRENT_TIMESTAMP;
