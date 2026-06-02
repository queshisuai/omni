-- owner: java-user

ALTER TABLE support_conversation
    ADD COLUMN IF NOT EXISTS close_request_reason TEXT,
    ADD COLUMN IF NOT EXISTS close_requested_by BIGINT REFERENCES "user"(id),
    ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS escalated_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS support_conversation_note (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    author_user_id BIGINT NOT NULL REFERENCES "user"(id),
    content TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_conversation_tag (
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    tag_code VARCHAR(32) NOT NULL,
    create_by BIGINT REFERENCES "user"(id),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, tag_code),
    CONSTRAINT chk_support_conversation_tag_code CHECK (tag_code IN ('REFUND', 'TICKET', 'ADMISSION', 'ACCOUNT', 'PAYMENT_EXCEPTION'))
);

CREATE TABLE IF NOT EXISTS support_conversation_audit (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversation(id),
    actor_user_id BIGINT REFERENCES "user"(id),
    action VARCHAR(40) NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32),
    detail TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_conversation_audit_action CHECK (action IN ('TAG_UPDATED', 'TRANSFERRED', 'ESCALATED', 'CLOSE_REQUESTED', 'CLOSE_REJECTED', 'CLOSED_CONFIRMED', 'AUTO_CLOSED'))
);

CREATE TABLE IF NOT EXISTS support_quick_reply (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(80) NOT NULL,
    content TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_quick_reply_status CHECK (status IN (0, 1))
);

INSERT INTO support_quick_reply (category, title, content, sort_order)
SELECT '退款', '退款进度说明', '您好，退款进度可以在订单详情页查看。若状态长时间未更新，请提供订单号，我会继续帮您核查。', 10
WHERE NOT EXISTS (SELECT 1 FROM support_quick_reply WHERE title = '退款进度说明');

INSERT INTO support_quick_reply (category, title, content, sort_order)
SELECT '票务', '票夹查看', '您好，购票成功后可在“我的票夹”查看电子票；若票夹为空，请先确认订单是否已支付成功。', 20
WHERE NOT EXISTS (SELECT 1 FROM support_quick_reply WHERE title = '票夹查看');

INSERT INTO support_quick_reply (category, title, content, sort_order)
SELECT '入场', '入场凭证说明', '您好，入场时请打开电子票动态码，并携带订单绑定的实名观演人证件。', 30
WHERE NOT EXISTS (SELECT 1 FROM support_quick_reply WHERE title = '入场凭证说明');

INSERT INTO support_quick_reply (category, title, content, sort_order)
SELECT '账号', '账号核验', '您好，为了保护账号安全，请提供注册手机号后四位和遇到问题的页面，我会帮您核验。', 40
WHERE NOT EXISTS (SELECT 1 FROM support_quick_reply WHERE title = '账号核验');

INSERT INTO support_quick_reply (category, title, content, sort_order)
SELECT '支付', '支付异常', '您好，如果支付已扣款但订单未更新，请提供支付时间和订单号，我会协助核查支付结果。', 50
WHERE NOT EXISTS (SELECT 1 FROM support_quick_reply WHERE title = '支付异常');

CREATE INDEX IF NOT EXISTS idx_support_note_conversation_time
    ON support_conversation_note(conversation_id, create_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_tag_code
    ON support_conversation_tag(tag_code, conversation_id);

CREATE INDEX IF NOT EXISTS idx_support_audit_conversation_time
    ON support_conversation_audit(conversation_id, create_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_quick_reply_status_sort
    ON support_quick_reply(status, sort_order ASC, id ASC);
