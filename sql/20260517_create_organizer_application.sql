CREATE TABLE IF NOT EXISTS organizer_application (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    organizer_name VARCHAR(100) NOT NULL,
    subject_type VARCHAR(20) NOT NULL,
    contact_name VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(100),
    license_no VARCHAR(100),
    business_scope TEXT,
    description TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP
);

COMMENT ON TABLE organizer_application IS '商户入驻申请表';
COMMENT ON COLUMN organizer_application.id IS '申请ID';
COMMENT ON COLUMN organizer_application.user_id IS '申请用户ID';
COMMENT ON COLUMN organizer_application.organizer_name IS '主办方名称';
COMMENT ON COLUMN organizer_application.subject_type IS '主体类型：personal=个人 enterprise=企业';
COMMENT ON COLUMN organizer_application.contact_name IS '联系人姓名';
COMMENT ON COLUMN organizer_application.contact_phone IS '联系人手机号';
COMMENT ON COLUMN organizer_application.contact_email IS '联系人邮箱';
COMMENT ON COLUMN organizer_application.license_no IS '营业执照号或证件号';
COMMENT ON COLUMN organizer_application.business_scope IS '经营范围';
COMMENT ON COLUMN organizer_application.description IS '申请说明';
COMMENT ON COLUMN organizer_application.status IS '0=待审核 1=已通过 2=已驳回';
COMMENT ON COLUMN organizer_application.reviewer_id IS '审核人ID';
COMMENT ON COLUMN organizer_application.review_note IS '审核备注';
COMMENT ON COLUMN organizer_application.create_time IS '创建时间';
COMMENT ON COLUMN organizer_application.update_time IS '更新时间';
COMMENT ON COLUMN organizer_application.review_time IS '审核时间';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_status ON organizer_application(status);
CREATE INDEX IF NOT EXISTS idx_organizer_application_create_time ON organizer_application(create_time DESC);
