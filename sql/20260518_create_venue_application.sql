CREATE TABLE venue_application (
    id BIGSERIAL PRIMARY KEY,
    applicant_id BIGINT NOT NULL REFERENCES "user"(id),
    venue_id BIGINT REFERENCES venue(id),
    venue_name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    capacity INTEGER,
    contact_name VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    qualification_no VARCHAR(100),
    business_scope TEXT,
    description TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP
);

COMMENT ON TABLE venue_application IS '场馆申请表';
COMMENT ON COLUMN venue_application.status IS '0=待审核 1=已通过 2=已驳回';

CREATE INDEX idx_venue_application_applicant ON venue_application(applicant_id);
CREATE INDEX idx_venue_application_status ON venue_application(status);
CREATE INDEX idx_venue_application_create_time ON venue_application(create_time DESC);
