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
    role VARCHAR(20) NOT NULL DEFAULT 'user',       -- 'user' | 'organizer' | 'admin'
    organizer_status SMALLINT DEFAULT 0,            -- 0:待审核 1:已认证 2:已拒绝
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
    order_id BIGINT REFERENCES "order"(id),
    seat_id BIGINT REFERENCES seat(id),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
CREATE TABLE review (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id),
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    order_id BIGINT REFERENCES "order"(id),         -- 关联订单（购票后才能评价）
    rating SMALLINT NOT NULL CHECK(rating >= 1 AND rating <= 5),
    content TEXT,
    images TEXT,                                     -- JSON数组，最多9张图
    like_count INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,                       -- 1:正常 0:隐藏
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX idx_order_user ON "order"(user_id);
CREATE INDEX idx_order_no ON "order"(order_no);
CREATE INDEX idx_order_status ON "order"(status);
CREATE INDEX idx_payment_order ON payment(order_id);
CREATE INDEX idx_payment_no ON payment(payment_no);
CREATE INDEX idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX idx_payment_trade_no ON payment(trade_no);
CREATE INDEX idx_refund_order ON refund_request(order_id);
CREATE UNIQUE INDEX idx_refund_order_active_unique ON refund_request(order_id) WHERE status IN (0, 1, 4);
CREATE INDEX idx_refund_user ON refund_request(user_id);
CREATE INDEX idx_refund_status ON refund_request(status);
CREATE INDEX idx_refund_no ON refund_request(refund_no);
CREATE INDEX idx_notification_user ON notification(user_id);
CREATE INDEX idx_stock_log_session ON stock_log(session_id);
CREATE INDEX idx_reservation_user ON reservation(user_id);
CREATE INDEX idx_session_activity ON session(activity_id);
CREATE INDEX idx_ticket_type_session ON ticket_type(session_id);
CREATE INDEX idx_seat_session ON seat(session_id);
CREATE INDEX idx_seat_ticket_type ON seat(ticket_type_id);
CREATE INDEX idx_review_activity ON review(activity_id);
CREATE INDEX idx_review_user ON review(user_id);
CREATE INDEX idx_review_order ON review(order_id);
CREATE INDEX idx_moment_user ON moment(user_id);
CREATE INDEX idx_moment_activity ON moment(activity_id);
