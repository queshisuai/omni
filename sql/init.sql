-- omni抢票平台数据库初始化脚本

-- 创建数据库
CREATE DATABASE omni_ticket ENCODING 'UTF8';

-- 连接数据库
\c omni_ticket;

-- 用户模块
CREATE TABLE "user" (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(100),
    nickname VARCHAR(50),
    email VARCHAR(100),
    avatar VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user',       -- 'user' | 'organizer' | 'admin' | 'support'
    organizer_status SMALLINT DEFAULT 0,            -- 0:待审核 1:已认证 2:已拒绝 3:已取消资格
    organizer_name VARCHAR(100),                    -- 主办方名称
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizer_application (
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

CREATE TABLE user_attendee (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(128) NOT NULL,
    id_no_mask VARCHAR(64) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status INTEGER NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_attendee_status CHECK (status IN (0, 1))
);

CREATE TABLE privacy_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT NOT NULL REFERENCES "user"(id),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id BIGINT,
    detail TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_conversation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    subject VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    source_type VARCHAR(16) NOT NULL DEFAULT 'AI',
    assigned_agent_id BIGINT REFERENCES "user"(id),
    last_message TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    CONSTRAINT chk_support_conversation_status CHECK (status IN ('OPEN', 'WAITING_AGENT', 'ASSIGNED', 'CLOSED')),
    CONSTRAINT chk_support_conversation_source CHECK (source_type IN ('AI', 'HUMAN'))
);

CREATE TABLE support_message (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    sender_user_id BIGINT REFERENCES "user"(id),
    sender_type VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_message_sender CHECK (sender_type IN ('USER', 'AI', 'AGENT', 'SYSTEM'))
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
CREATE UNIQUE INDEX idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX idx_organizer_application_status ON organizer_application(status);
CREATE INDEX idx_organizer_application_create_time ON organizer_application(create_time DESC);

-- 分类表
CREATE TABLE category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(255),
    sort INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 艺人表
CREATE TABLE artist (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar VARCHAR(255),
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 场馆表
CREATE TABLE venue (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    address VARCHAR(255),
    capacity INTEGER,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE venue_area (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    name VARCHAR(100) NOT NULL,
    row_count INTEGER NOT NULL,
    seats_per_row INTEGER NOT NULL,
    row_start INTEGER DEFAULT 1,
    seat_start INTEGER DEFAULT 1,
    color VARCHAR(20),
    sort INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venue_seat (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    seat_label VARCHAR(30) NOT NULL,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_seat (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES session(id),
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    venue_seat_id BIGINT NOT NULL REFERENCES venue_seat(id),
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    seat_label VARCHAR(30) NOT NULL,
    status SMALLINT DEFAULT 1,
    lock_expire_time TIMESTAMP,
    lock_request_id VARCHAR(64),
    seat_block_id BIGINT,
    order_id BIGINT REFERENCES "order"(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_type_area (
    id BIGSERIAL PRIMARY KEY,
    ticket_type_id BIGINT NOT NULL REFERENCES ticket_type(id),
    session_id BIGINT NOT NULL REFERENCES session(id),
    area_id BIGINT NOT NULL REFERENCES venue_area(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 活动表
CREATE TABLE activity (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES category(id),
    artist_id BIGINT REFERENCES artist(id),
    organizer_id BIGINT REFERENCES "user"(id),  -- 主办方（B端商户）
    name VARCHAR(200) NOT NULL,
    description TEXT,
    poster VARCHAR(255),
    status SMALLINT DEFAULT 1,
    real_name_required BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_transfer_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 场次表
CREATE TABLE session (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activity(id),
    venue_id BIGINT REFERENCES venue(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 票档表
CREATE TABLE ticket_type (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES session(id),
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    total_stock INTEGER NOT NULL,
    remain_stock INTEGER NOT NULL,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 预约表
CREATE TABLE reservation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES "user"(id),
    session_id BIGINT REFERENCES session(id),
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id)
);

CREATE TABLE performance_subscription (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id BIGINT,
    target_value VARCHAR(120),
    target_name VARCHAR(200),
    activity_id BIGINT REFERENCES activity(id),
    artist_id BIGINT REFERENCES artist(id),
    city VARCHAR(64),
    remind_before_minutes INTEGER DEFAULT 30,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_performance_subscription_status CHECK (status IN (0, 1))
);

CREATE TABLE activity_marketing_rule (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    coupon_name VARCHAR(120),
    discount_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    threshold_amount NUMERIC(12, 2),
    discount_amount NUMERIC(12, 2),
    max_coupon_count INTEGER,
    per_user_limit INTEGER,
    claimed_count INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_marketing_discount_type CHECK (discount_type IN ('NONE', 'FULL_REDUCTION', 'DIRECT_REDUCTION')),
    CONSTRAINT chk_activity_marketing_status CHECK (status IN (0, 1)),
    CONSTRAINT chk_activity_marketing_amount CHECK (
        (threshold_amount IS NULL OR threshold_amount >= 0)
        AND (discount_amount IS NULL OR discount_amount >= 0)
    ),
    CONSTRAINT chk_activity_marketing_count CHECK (
        (max_coupon_count IS NULL OR max_coupon_count > 0)
        AND (per_user_limit IS NULL OR per_user_limit > 0)
        AND claimed_count >= 0
        AND used_count >= 0
    )
);

-- 订单表
CREATE TABLE "order" (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES "user"(id),
    session_id BIGINT REFERENCES session(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    quantity INTEGER DEFAULT 1,
    amount DECIMAL(10, 2) NOT NULL,
    status SMALLINT DEFAULT 1,
    user_hidden BOOLEAN DEFAULT FALSE,
    user_deleted_at TIMESTAMP,
    user_delete_expires_at TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 座位表（可选，演唱会可能有座位）
CREATE TABLE seat (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES session(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    seat_no VARCHAR(20) NOT NULL,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 座位与订单关联表
CREATE TABLE order_seat (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id),
    session_seat_id BIGINT NOT NULL REFERENCES session_seat(id),
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    status SMALLINT DEFAULT 1,
    seat_label VARCHAR(128),
    lock_expire_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_attendee (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT NOT NULL,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(128) NOT NULL,
    id_no_mask VARCHAR(64) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    status INTEGER NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_attendee_status CHECK (status IN (1, 2, 3))
);

CREATE TABLE order_snapshot (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES "order"(id) ON DELETE CASCADE,
    activity_id BIGINT,
    activity_name VARCHAR(255),
    activity_poster VARCHAR(500),
    tour_id BIGINT,
    station_id BIGINT,
    session_id BIGINT,
    session_time TIMESTAMP,
    venue_name VARCHAR(255),
    ticket_type_id BIGINT,
    ticket_name VARCHAR(255),
    unit_price NUMERIC(10, 2),
    quantity INTEGER,
    seat_labels TEXT,
    seat_selection_mode VARCHAR(32),
    grab_request_id VARCHAR(64),
    requested_ticket_type_id BIGINT,
    matched_ticket_type_id BIGINT,
    auto_downgraded BOOLEAN NOT NULL DEFAULT FALSE,
    team_id BIGINT,
    team_grab_request_id VARCHAR(64),
    team_order BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_transfer_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE electronic_ticket (
    id BIGSERIAL PRIMARY KEY,
    ticket_no VARCHAR(64) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL,
    original_user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT,
    real_name VARCHAR(80),
    id_type VARCHAR(32),
    id_no_mask VARCHAR(64),
    phone VARCHAR(32),
    seat_label VARCHAR(128),
    status INTEGER NOT NULL DEFAULT 1,
    checked_in_at TIMESTAMP,
    invalid_reason VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_electronic_ticket_status CHECK (status IN (1, 2, 3, 4))
);

CREATE TABLE ticket_transfer (
    id BIGSERIAL PRIMARY KEY,
    transfer_code VARCHAR(64) NOT NULL UNIQUE,
    ticket_id BIGINT NOT NULL REFERENCES electronic_ticket(id) ON DELETE CASCADE,
    new_ticket_id BIGINT REFERENCES electronic_ticket(id) ON DELETE SET NULL,
    from_user_id BIGINT NOT NULL,
    to_user_id BIGINT,
    status INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP NOT NULL,
    claimed_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_transfer_status CHECK (status IN (1, 2, 3, 4))
);

CREATE TABLE grab_request (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    seat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    allocate_random BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL,
    request_type VARCHAR(32) NOT NULL DEFAULT 'NORMAL_GRAB',
    queue_seq BIGINT,
    requested_ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    allow_auto_downgrade BOOLEAN NOT NULL DEFAULT FALSE,
    current_ticket_type_id BIGINT,
    current_attempt_index INTEGER NOT NULL DEFAULT 0,
    matched_ticket_type_id BIGINT,
    progress_status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    progress_message VARCHAR(512),
    attempts_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_id BIGINT,
    fail_reason VARCHAR(512),
    worker_claimed_at TIMESTAMPTZ,
    worker_id VARCHAR(128),
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expire_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_grab_request_request_id UNIQUE (request_id),
    CONSTRAINT uk_grab_request_user_idempotency UNIQUE (user_id, idempotency_key),
    CONSTRAINT chk_grab_request_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_grab_request_status CHECK (status IN (
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'PENDING',
        'ACCEPTED',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'PENDING_RECOVERY',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    )),
    CONSTRAINT chk_grab_request_progress_status CHECK (progress_status IN (
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'PENDING_RECOVERY',
        'LIMITED',
        'FAILED',
        'EXPIRED'
    ))
);

CREATE TABLE ticket_team (
    id BIGSERIAL PRIMARY KEY,
    invite_code VARCHAR(32) NOT NULL,
    leader_user_id BIGINT NOT NULL,
    activity_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    strategy VARCHAR(32) NOT NULL DEFAULT 'STRICT_CONTIGUOUS',
    fallback_strategy_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_ticket_team_invite_code UNIQUE (invite_code),
    CONSTRAINT chk_ticket_team_size CHECK (size BETWEEN 1 AND 6),
    CONSTRAINT chk_ticket_team_strategy CHECK (strategy IN ('STRICT_CONTIGUOUS', 'SAME_BLOCK', 'SAME_TICKET_TYPE', 'FALLBACK')),
    CONSTRAINT chk_ticket_team_status CHECK (status IN ('DRAFT', 'READY', 'GRABBING', 'LOCKED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
);

CREATE TABLE ticket_team_member (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id) ON DELETE CASCADE,
    session_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    seat_id BIGINT,
    order_seat_id BIGINT,
    join_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_ticket_team_member_team_user UNIQUE (team_id, user_id),
    CONSTRAINT chk_ticket_team_member_role CHECK (role IN ('LEADER', 'MEMBER')),
    CONSTRAINT chk_ticket_team_member_status CHECK (status IN ('INVITED', 'JOINED', 'CONFIRMED', 'LEFT'))
);

CREATE TABLE team_grab_request (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    grab_request_id VARCHAR(64) NOT NULL,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id),
    trigger_user_id BIGINT NOT NULL,
    payer_user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    strategy VARCHAR(32) NOT NULL,
    fallback_strategy_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_strategy VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    order_id BIGINT,
    locked_seat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    seat_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    fail_reason VARCHAR(512),
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    update_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_team_grab_request_request_id UNIQUE (request_id),
    CONSTRAINT uk_team_grab_request_grab_request_id UNIQUE (grab_request_id),
    CONSTRAINT chk_team_grab_request_quantity CHECK (quantity BETWEEN 2 AND 6),
    CONSTRAINT chk_team_grab_request_status CHECK (status IN ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED', 'FAILED', 'EXPIRED'))
);

CREATE TABLE team_seat_assignment (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES ticket_team(id),
    user_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    order_seat_id BIGINT NOT NULL,
    session_seat_id BIGINT NOT NULL,
    seat_label VARCHAR(128),
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_team_assignment_team_user UNIQUE (team_id, user_id),
    CONSTRAINT uk_team_assignment_order_seat UNIQUE (order_seat_id)
);

CREATE SEQUENCE IF NOT EXISTS waitlist_priority_seq;

CREATE TABLE waitlist_entry (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    seat_preference JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'WAITING',
    priority_no BIGINT NOT NULL DEFAULT nextval('waitlist_priority_seq'),
    offer_order_id BIGINT,
    offer_expire_time TIMESTAMP,
    fail_reason VARCHAR(512),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_entry_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_entry_status CHECK (status IN ('WAITING', 'ALLOCATING', 'OFFERED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'))
);

CREATE TABLE waitlist_offer (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES waitlist_entry(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFERED',
    expire_time TIMESTAMP NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_offer_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_offer_status CHECK (status IN ('OFFERED', 'PAID', 'EXPIRED', 'CANCELLED'))
);

CREATE TABLE waitlist_allocation_log (
    id BIGSERIAL PRIMARY KEY,
    event_key VARCHAR(160) NOT NULL,
    attempt_no INTEGER NOT NULL DEFAULT 0,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    released_quantity INTEGER NOT NULL,
    allocated_entry_id BIGINT,
    order_id BIGINT,
    source_order_id BIGINT,
    status VARCHAR(32) NOT NULL,
    message VARCHAR(1024),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_allocation_quantity CHECK (released_quantity > 0),
    CONSTRAINT chk_waitlist_allocation_status CHECK (status IN ('PROCESSING', 'FAILED', 'OFFERED', 'NO_MATCH', 'DUPLICATE'))
);

CREATE TABLE venue_seat_layout_template (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL DEFAULT '演出舞台 / STAGE',
    stage_x INTEGER NOT NULL DEFAULT 500,
    stage_y INTEGER NOT NULL DEFAULT 50,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_seat_layout_template_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE venue_seat_layout_template_section (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES venue_seat_layout_template(id) ON DELETE CASCADE,
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_template_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_template_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_template_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_template_section_key UNIQUE (template_id, section_key)
);

CREATE TABLE activity_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    layout_mode VARCHAR(20) NOT NULL DEFAULT 'unified',
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_seat_layout_mode CHECK (layout_mode IN ('unified', 'per_session')),
    CONSTRAINT chk_activity_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE activity_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    activity_layout_id BIGINT NOT NULL REFERENCES activity_seat_layout(id) ON DELETE CASCADE,
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_activity_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_activity_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_activity_section_key UNIQUE (activity_layout_id, section_key)
);

CREATE TABLE session_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL UNIQUE REFERENCES session(id) ON DELETE CASCADE,
    activity_layout_id BIGINT REFERENCES activity_seat_layout(id),
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE session_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    session_layout_id BIGINT NOT NULL REFERENCES session_seat_layout(id) ON DELETE CASCADE,
    activity_layout_section_id BIGINT REFERENCES activity_seat_layout_section(id),
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    seat_count INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_session_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_session_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_session_section_key UNIQUE (session_layout_id, section_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS layout_section_id BIGINT REFERENCES session_seat_layout_section(id);

CREATE INDEX idx_venue_seat_layout_template_venue ON venue_seat_layout_template(venue_id);
CREATE INDEX idx_template_section_template ON venue_seat_layout_template_section(template_id);
CREATE INDEX idx_activity_seat_layout_activity ON activity_seat_layout(activity_id);
CREATE INDEX idx_activity_section_layout ON activity_seat_layout_section(activity_layout_id);
CREATE INDEX idx_session_seat_layout_session ON session_seat_layout(session_id);
CREATE INDEX idx_session_section_layout ON session_seat_layout_section(session_layout_id);
CREATE INDEX idx_session_section_ticket_type ON session_seat_layout_section(ticket_type_id);
CREATE INDEX idx_session_seat_layout_section ON session_seat(layout_section_id);

-- 短信验证码表（沙盒版）
CREATE TABLE sms_code (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expire_time TIMESTAMP NOT NULL,
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 支付记录表
CREATE TABLE payment (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES "order"(id),
    payment_no VARCHAR(64) NOT NULL UNIQUE,
    payment_method VARCHAR(30) DEFAULT 'MOCK',
    out_trade_no VARCHAR(64),
    trade_no VARCHAR(64),
    buyer_id VARCHAR(64),
    amount DECIMAL(10, 2) NOT NULL,
    status SMALLINT DEFAULT 0,
    callback_data TEXT,
    notify_time TIMESTAMP,
    raw_notify TEXT,
    pay_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- payment.status: 0=待支付, 1=支付成功, 2=支付失败

-- 退款申请表
CREATE TABLE refund_request (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id),
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    payment_id BIGINT REFERENCES payment(id),
    refund_no VARCHAR(64) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    alipay_refund_no VARCHAR(64),
    raw_response TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP,
    refund_time TIMESTAMP
);
-- refund_request.status: 0=待审核, 1=已退款, 2=已拒绝, 3=退款失败, 4=退款处理中

-- 通知记录表
CREATE TABLE notification (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES "user"(id),
    order_id BIGINT REFERENCES "order"(id),
    type VARCHAR(20) NOT NULL,
    content TEXT,
    status SMALLINT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- notification.type: SMS=短信, EMAIL=邮件
-- notification.status: 0=待发送, 1=已发送, 2=发送失败

-- 库存流水表
CREATE TABLE stock_log (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES session(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
    change_quantity INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    order_id BIGINT REFERENCES "order"(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- stock_log.change_type: PREEMPT=预占, RELEASE=释放, REFUND=退款

-- 用户认证关联表（微信/支付宝）
CREATE TABLE user_auth (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES "user"(id),
    auth_type VARCHAR(20) NOT NULL,
    auth_identifier VARCHAR(200) NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(auth_type, auth_identifier)
);

-- 评价表
CREATE TABLE activity_review (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    order_id BIGINT,                                -- 关联订单（购票后评价时传入）
    rating SMALLINT NOT NULL CHECK(rating >= 1 AND rating <= 5),
    content TEXT,
    images TEXT,                                     -- JSON数组，最多9张图
    like_count INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,              -- 1:正常 0:隐藏
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_question (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    answer TEXT,
    answered_by BIGINT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',   -- PENDING/ANSWERED/HIDDEN
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    CONSTRAINT chk_activity_question_status CHECK (status IN ('PENDING', 'ANSWERED', 'HIDDEN'))
);

-- 动态表
CREATE TABLE moment (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    activity_id BIGINT REFERENCES activity(id),      -- 关联活动（可选）
    content TEXT NOT NULL,
    images TEXT,                                     -- JSON数组
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,                       -- 1:正常 0:隐藏
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_user_phone ON "user"(phone);
CREATE INDEX idx_user_auth_user ON user_auth(user_id);
CREATE INDEX idx_user_attendee_user_status ON user_attendee(user_id, status, is_default DESC, create_time DESC);
CREATE UNIQUE INDEX uk_user_attendee_active_identity ON user_attendee(user_id, id_type, id_no_hash) WHERE status = 1;
CREATE INDEX idx_privacy_audit_actor_time ON privacy_audit_log(actor_user_id, create_time DESC);
CREATE INDEX idx_support_conversation_user_time ON support_conversation(user_id, update_time DESC, id DESC);
CREATE INDEX idx_support_conversation_agent_status ON support_conversation(assigned_agent_id, status, update_time DESC);
CREATE INDEX idx_support_conversation_status_time ON support_conversation(status, update_time DESC);
CREATE INDEX idx_support_message_conversation_time ON support_message(conversation_id, id ASC);
CREATE INDEX idx_order_user ON "order"(user_id);
CREATE INDEX idx_order_no ON "order"(order_no);
CREATE INDEX idx_order_status ON "order"(status);
CREATE INDEX idx_order_seat_order ON order_seat(order_id);
CREATE INDEX idx_order_seat_session_seat ON order_seat(session_seat_id);
CREATE INDEX idx_order_seat_status ON order_seat(status);
CREATE INDEX idx_order_attendee_order ON order_attendee(order_id);
CREATE INDEX idx_order_attendee_seat ON order_attendee(order_seat_id);
CREATE INDEX idx_order_attendee_session_identity_active ON order_attendee(session_id, id_type, id_no_hash) WHERE status = 1;
CREATE INDEX idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX idx_order_snapshot_session_id ON order_snapshot(session_id);
CREATE INDEX idx_order_snapshot_grab_request_id ON order_snapshot(grab_request_id);
CREATE UNIQUE INDEX uk_order_snapshot_grab_request_id ON order_snapshot(grab_request_id) WHERE grab_request_id IS NOT NULL;
CREATE INDEX idx_order_snapshot_team_id ON order_snapshot(team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX uk_order_snapshot_team_grab_request ON order_snapshot(team_grab_request_id) WHERE team_order = TRUE AND team_grab_request_id IS NOT NULL;
CREATE INDEX idx_electronic_ticket_user_status ON electronic_ticket(user_id, status, create_time DESC);
CREATE INDEX idx_electronic_ticket_order ON electronic_ticket(order_id);
CREATE INDEX idx_electronic_ticket_session ON electronic_ticket(session_id, ticket_type_id, status);
CREATE INDEX idx_ticket_transfer_ticket_status ON ticket_transfer(ticket_id, status, create_time DESC);
CREATE INDEX idx_ticket_transfer_from_user ON ticket_transfer(from_user_id, create_time DESC);
CREATE INDEX idx_ticket_transfer_to_user ON ticket_transfer(to_user_id, create_time DESC) WHERE to_user_id IS NOT NULL;
CREATE INDEX idx_grab_request_status_expire_time ON grab_request(status, expire_time);
CREATE INDEX idx_grab_request_user_created_at ON grab_request(user_id, created_at DESC);
CREATE INDEX idx_grab_request_session_queue_seq ON grab_request(session_id, queue_seq);
CREATE INDEX idx_grab_request_progress_expire_time ON grab_request(progress_status, expire_time);
CREATE UNIQUE INDEX uk_ticket_team_member_active_session ON ticket_team_member(user_id, session_id) WHERE status IN ('JOINED', 'CONFIRMED');
CREATE UNIQUE INDEX uk_team_grab_request_active_team ON team_grab_request(team_id) WHERE status IN ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED');
CREATE INDEX idx_ticket_team_leader ON ticket_team(leader_user_id, create_time DESC);
CREATE INDEX idx_ticket_team_session ON ticket_team(session_id, status);
CREATE INDEX idx_ticket_team_member_team ON ticket_team_member(team_id, status, join_time);
CREATE INDEX idx_team_grab_request_order ON team_grab_request(order_id);
CREATE INDEX idx_team_grab_request_grab_request ON team_grab_request(grab_request_id);
CREATE UNIQUE INDEX uk_waitlist_entry_active_user_ticket ON waitlist_entry(user_id, session_id, ticket_type_id) WHERE status IN ('WAITING', 'ALLOCATING', 'OFFERED');
CREATE INDEX idx_waitlist_entry_queue ON waitlist_entry(session_id, ticket_type_id, status, priority_no, create_time, id);
CREATE INDEX idx_waitlist_entry_user ON waitlist_entry(user_id, create_time DESC);
CREATE UNIQUE INDEX uk_waitlist_offer_order ON waitlist_offer(order_id);
CREATE INDEX idx_waitlist_offer_entry ON waitlist_offer(entry_id, status);
CREATE INDEX idx_waitlist_offer_expire ON waitlist_offer(status, expire_time);
CREATE UNIQUE INDEX uk_waitlist_allocation_event_attempt ON waitlist_allocation_log(event_key, attempt_no);
CREATE INDEX idx_waitlist_allocation_event ON waitlist_allocation_log(event_key, create_time);
CREATE INDEX idx_payment_order ON payment(order_id);
CREATE INDEX idx_payment_no ON payment(payment_no);
CREATE INDEX idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX idx_payment_trade_no ON payment(trade_no);
CREATE INDEX idx_refund_order ON refund_request(order_id);
CREATE UNIQUE INDEX idx_refund_order_active_unique ON refund_request(order_id) WHERE status IN (0, 1, 4);
CREATE INDEX idx_refund_user ON refund_request(user_id);
CREATE INDEX idx_refund_status ON refund_request(status);
CREATE INDEX idx_refund_no ON refund_request(refund_no);
CREATE INDEX idx_venue_application_applicant ON venue_application(applicant_id);
CREATE INDEX idx_venue_application_status ON venue_application(status);
CREATE INDEX idx_venue_application_create_time ON venue_application(create_time DESC);
CREATE INDEX idx_venue_area_venue ON venue_area(venue_id);
CREATE INDEX idx_venue_area_status ON venue_area(status);
CREATE INDEX idx_venue_seat_venue ON venue_seat(venue_id);
CREATE INDEX idx_venue_seat_area ON venue_seat(area_id);
CREATE UNIQUE INDEX idx_venue_seat_area_position ON venue_seat(area_id, row_no, seat_no) WHERE status = 1;
CREATE INDEX idx_session_seat_session ON session_seat(session_id);
CREATE INDEX idx_session_seat_venue ON session_seat(venue_id);
CREATE INDEX idx_session_seat_area ON session_seat(area_id);
CREATE INDEX idx_session_seat_status ON session_seat(status);
CREATE INDEX idx_session_seat_lock_request ON session_seat(lock_request_id) WHERE lock_request_id IS NOT NULL;
CREATE INDEX idx_session_seat_team_lock_lookup ON session_seat(session_id, ticket_type_id, status, seat_block_id, (CASE WHEN seat_block_id IS NULL THEN layout_section_id END), row_no, seat_no, id) WHERE order_id IS NULL AND lock_expire_time IS NULL;
CREATE UNIQUE INDEX idx_session_seat_session_venue_seat ON session_seat(session_id, venue_seat_id);
CREATE UNIQUE INDEX idx_session_seat_layout_position ON session_seat(session_id, layout_section_id, row_no, seat_no) WHERE layout_section_id IS NOT NULL;
CREATE INDEX idx_ticket_type_area_ticket_type ON ticket_type_area(ticket_type_id);
CREATE INDEX idx_ticket_type_area_session ON ticket_type_area(session_id);
CREATE UNIQUE INDEX idx_ticket_type_area_session_area_unique ON ticket_type_area(session_id, area_id);
CREATE INDEX idx_notification_user ON notification(user_id);
CREATE INDEX idx_stock_log_session ON stock_log(session_id);
CREATE INDEX idx_reservation_user ON reservation(user_id);
CREATE INDEX idx_performance_subscription_user ON performance_subscription(user_id, status, create_time DESC);
CREATE INDEX idx_performance_subscription_activity ON performance_subscription(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_performance_subscription_artist ON performance_subscription(artist_id) WHERE artist_id IS NOT NULL;
CREATE UNIQUE INDEX uk_performance_subscription_active_target ON performance_subscription(user_id, target_type, COALESCE(target_id, 0), COALESCE(target_value, '')) WHERE status = 1;
CREATE UNIQUE INDEX uk_activity_marketing_rule_activity ON activity_marketing_rule(activity_id);
CREATE INDEX idx_activity_marketing_rule_status ON activity_marketing_rule(status, enabled);
CREATE INDEX idx_session_activity ON session(activity_id);
CREATE INDEX idx_ticket_type_session ON ticket_type(session_id);
CREATE INDEX idx_seat_session ON seat(session_id);
CREATE INDEX idx_seat_ticket_type ON seat(ticket_type_id);
CREATE UNIQUE INDEX uk_activity_review_order_active ON activity_review(activity_id, user_id, order_id) WHERE order_id IS NOT NULL AND status = 1;
CREATE INDEX idx_activity_review_activity_time ON activity_review(activity_id, status, create_time DESC);
CREATE INDEX idx_activity_review_user ON activity_review(user_id);
CREATE INDEX idx_activity_question_activity_time ON activity_question(activity_id, status, create_time DESC);
CREATE INDEX idx_moment_user ON moment(user_id);
CREATE INDEX idx_moment_activity ON moment(activity_id);
