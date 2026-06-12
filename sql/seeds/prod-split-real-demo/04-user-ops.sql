-- 04-user-ops.sql
-- 本地 prod-split 真实演示 seed，仅供联调，不属于生产迁移。
-- target database: omni_user


BEGIN;
INSERT INTO "user" (id, phone, password, nickname, role, organizer_status, organizer_name, status, create_time, update_time) VALUES
(2002, '13800000001', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '平台管理员', 'admin', 0, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2003, '13800000002', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '星河演艺主办方', 'organizer', 1, '星河演艺集团', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2004, '13900000001', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '普通用户小明', 'user', 0, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2005, '13800000003', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '城市剧场联盟', 'organizer', 1, '城市剧场联盟', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2006, '13800000004', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '运动赛事运营', 'organizer', 1, '华夏体育赛事运营', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2007, '13800000005', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '亲子展览主办方', 'organizer', 1, '童梦展演文化', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2008, '13900000002', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '观演用户小夏', 'user', 0, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, nickname = EXCLUDED.nickname, role = EXCLUDED.role, organizer_status = EXCLUDED.organizer_status, organizer_name = EXCLUDED.organizer_name, status = EXCLUDED.status, update_time = EXCLUDED.update_time;

INSERT INTO rbac_role (code, name) VALUES
('organizer_admin', '平台主办方运营员')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, update_time = CURRENT_TIMESTAMP;

INSERT INTO "user" (role, phone, nickname, password, status, create_time, update_time) VALUES
('organizer_admin', '13910000004', '平台主办方运营员', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (phone) DO UPDATE
SET role = EXCLUDED.role,
    nickname = EXCLUDED.nickname,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO "user" (role, phone, nickname, password, status, create_time, update_time) VALUES
('support', '13910000002', '客服主管', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('support', '13910000003', '普通客服', '$2b$10$IrlVGWCZr8mdeVWCvvlCzOftfq/KiIHItDinPUZvD6KyBDHzY1BzG', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (phone) DO UPDATE
SET role = EXCLUDED.role,
    nickname = EXCLUDED.nickname,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO support_account (user_id, phone, nickname, status, support_role, create_time, update_time)
SELECT id, phone, nickname, 1,
       CASE WHEN phone = '13910000002' THEN 'support_manager' ELSE 'support_agent' END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "user"
WHERE phone IN ('13910000002', '13910000003')
  AND role = 'support'
ON CONFLICT (user_id) DO UPDATE
SET phone = EXCLUDED.phone,
    nickname = EXCLUDED.nickname,
    status = EXCLUDED.status,
    support_role = EXCLUDED.support_role,
    update_time = CURRENT_TIMESTAMP;

UPDATE "user"
SET nickname = '平台主办方运营员',
    update_time = CURRENT_TIMESTAMP
WHERE role = 'organizer_admin'
  AND nickname = '主办方' || '管理员';

DELETE FROM support_conversation_audit WHERE conversation_id BETWEEN 988101 AND 988120;
DELETE FROM support_conversation_tag WHERE conversation_id BETWEEN 988101 AND 988120;
DELETE FROM support_conversation_note WHERE conversation_id BETWEEN 988101 AND 988120;
DELETE FROM support_message WHERE conversation_id BETWEEN 988101 AND 988120;
DELETE FROM support_conversation WHERE id BETWEEN 988101 AND 988120;
DELETE FROM support_quick_reply WHERE title IN ('用户上下文核查', '退款异常核查');
DELETE FROM exception_task WHERE id BETWEEN 986001 AND 986050;
DELETE FROM reconciliation_difference WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM reconciliation_detail WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM reconciliation_batch WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM operation_audit_log WHERE id BETWEEN 987001 AND 987050;
DELETE FROM organizer_ops_follow_up
WHERE organizer_user_id IN (2003, 2005, 2006, 2007)
  AND content LIKE 'real-demo:%';

WITH agent_account AS (
    SELECT id AS agent_id
    FROM "user"
    WHERE phone = '13910000003'
      AND role = 'support'
    LIMIT 1
)
INSERT INTO support_conversation (
    id,
    user_id,
    subject,
    status,
    source_type,
    assigned_agent_id,
    last_message,
    create_time,
    update_time,
    first_response_due_at,
    first_agent_replied_at,
    last_user_message_at,
    last_agent_message_at
)
SELECT
    988101,
    2004,
    'DMREAL980045 退款和票夹异常',
    'ASSIGNED',
    'HUMAN',
    agent_account.agent_id,
    '已打开用户上下文，正在核查 REFREAL985004 退款和票夹状态。',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '10 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 hours 55 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 hours 45 minutes',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '10 minutes'
FROM agent_account
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    subject = EXCLUDED.subject,
    status = EXCLUDED.status,
    source_type = EXCLUDED.source_type,
    assigned_agent_id = EXCLUDED.assigned_agent_id,
    closed_at = NULL,
    last_message = EXCLUDED.last_message,
    update_time = EXCLUDED.update_time,
    first_response_due_at = EXCLUDED.first_response_due_at,
    first_agent_replied_at = EXCLUDED.first_agent_replied_at,
    last_user_message_at = EXCLUDED.last_user_message_at,
    last_agent_message_at = EXCLUDED.last_agent_message_at;

INSERT INTO support_conversation (
    id,
    user_id,
    subject,
    status,
    source_type,
    assigned_agent_id,
    last_message,
    create_time,
    update_time,
    closed_at,
    first_response_due_at,
    first_agent_replied_at,
    last_user_message_at,
    last_agent_message_at
)
VALUES (
    988102,
    2008,
    '默认待处理队列：DMREAL980006 主办方退款咨询',
    'WAITING_AGENT',
    'HUMAN',
    NULL,
    '我想确认 DMREAL980006 的退款 REFREAL985009 是否已经进入主办方处理。',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    subject = EXCLUDED.subject,
    status = EXCLUDED.status,
    source_type = EXCLUDED.source_type,
    assigned_agent_id = NULL,
    closed_at = NULL,
    last_message = EXCLUDED.last_message,
    update_time = EXCLUDED.update_time,
    first_response_due_at = EXCLUDED.first_response_due_at,
    first_agent_replied_at = EXCLUDED.first_agent_replied_at,
    last_user_message_at = EXCLUDED.last_user_message_at,
    last_agent_message_at = EXCLUDED.last_agent_message_at;

WITH agent_account AS (
    SELECT id AS agent_id
    FROM "user"
    WHERE phone = '13910000003'
      AND role = 'support'
    LIMIT 1
)
INSERT INTO support_message (id, conversation_id, sender_user_id, sender_type, content, create_time)
SELECT *
FROM (
    SELECT 988201::BIGINT, 988101::BIGINT, 2004::BIGINT, 'USER'::VARCHAR, '我订单 DMREAL980045 申请退款后，票夹里还有票，退款单 REFREAL985004 是什么状态？'::TEXT, CURRENT_TIMESTAMP - INTERVAL '2 hours'
    UNION ALL
    SELECT 988202::BIGINT, 988101::BIGINT, agent_account.agent_id, 'AGENT'::VARCHAR, '我先打开用户上下文，核对订单、退款、电子票、候补、抢票和通知记录。'::TEXT, CURRENT_TIMESTAMP - INTERVAL '1 hours 45 minutes'
    FROM agent_account
    UNION ALL
    SELECT 988203::BIGINT, 988101::BIGINT, 2004::BIGINT, 'USER'::VARCHAR, '如果退款完成，已核验的票还会影响入场吗？'::TEXT, CURRENT_TIMESTAMP - INTERVAL '30 minutes'
    UNION ALL
    SELECT 988204::BIGINT, 988101::BIGINT, agent_account.agent_id, 'AGENT'::VARCHAR, '已看到 REFREAL985004 已审核通过，票夹里有未核验和已核验票，我会按订单详情继续处理。'::TEXT, CURRENT_TIMESTAMP - INTERVAL '10 minutes'
    FROM agent_account
) AS seed(id, conversation_id, sender_user_id, sender_type, content, create_time)
ON CONFLICT (id) DO UPDATE
SET conversation_id = EXCLUDED.conversation_id,
    sender_user_id = EXCLUDED.sender_user_id,
    sender_type = EXCLUDED.sender_type,
    content = EXCLUDED.content,
    create_time = EXCLUDED.create_time;

INSERT INTO support_message (id, conversation_id, sender_user_id, sender_type, content, create_time)
VALUES (
    988205,
    988102,
    2008,
    'USER',
    '我想确认 DMREAL980006 的退款 REFREAL985009 是否已经进入主办方处理。',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes'
)
ON CONFLICT (id) DO UPDATE
SET conversation_id = EXCLUDED.conversation_id,
    sender_user_id = EXCLUDED.sender_user_id,
    sender_type = EXCLUDED.sender_type,
    content = EXCLUDED.content,
    create_time = EXCLUDED.create_time;

WITH agent_account AS (
    SELECT id AS agent_id
    FROM "user"
    WHERE phone = '13910000003'
      AND role = 'support'
    LIMIT 1
)
INSERT INTO support_conversation_note (id, conversation_id, author_user_id, content, create_time)
SELECT
    988301,
    988101,
    agent_account.agent_id,
    'real-demo: 用户上下文显示 2004 有待支付订单、已支付订单、REFREAL985004 退款、电子票、候补、抢票和站内通知，可用于客服右侧面板验收。',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes'
FROM agent_account
ON CONFLICT (id) DO UPDATE
SET conversation_id = EXCLUDED.conversation_id,
    author_user_id = EXCLUDED.author_user_id,
    content = EXCLUDED.content,
    create_time = EXCLUDED.create_time;

WITH agent_account AS (
    SELECT id AS agent_id
    FROM "user"
    WHERE phone = '13910000003'
      AND role = 'support'
    LIMIT 1
)
INSERT INTO support_conversation_tag (conversation_id, tag_code, create_by, create_time)
SELECT 988101, tag_code, agent_account.agent_id, CURRENT_TIMESTAMP - INTERVAL '7 minutes'
FROM agent_account
CROSS JOIN (VALUES ('REFUND'::VARCHAR), ('TICKET'::VARCHAR), ('PAYMENT_EXCEPTION'::VARCHAR)) AS seed(tag_code)
ON CONFLICT (conversation_id, tag_code) DO UPDATE
SET create_by = EXCLUDED.create_by,
    create_time = EXCLUDED.create_time;

WITH agent_account AS (
    SELECT id AS agent_id
    FROM "user"
    WHERE phone = '13910000003'
      AND role = 'support'
    LIMIT 1
)
INSERT INTO support_conversation_audit (id, conversation_id, actor_user_id, action, from_status, to_status, detail, create_time)
SELECT *
FROM (
    SELECT 988401::BIGINT, 988101::BIGINT, agent_account.agent_id, 'TRANSFERRED'::VARCHAR, 'WAITING_AGENT'::VARCHAR, 'ASSIGNED'::VARCHAR, '普通客服接入退款和票夹问题'::TEXT, CURRENT_TIMESTAMP - INTERVAL '1 hours 50 minutes'
    FROM agent_account
    UNION ALL
    SELECT 988402::BIGINT, 988101::BIGINT, agent_account.agent_id, 'TAG_UPDATED'::VARCHAR, 'ASSIGNED'::VARCHAR, 'ASSIGNED'::VARCHAR, '标记退款、票务和支付异常标签'::TEXT, CURRENT_TIMESTAMP - INTERVAL '7 minutes'
    FROM agent_account
) AS seed(id, conversation_id, actor_user_id, action, from_status, to_status, detail, create_time)
ON CONFLICT (id) DO UPDATE
SET conversation_id = EXCLUDED.conversation_id,
    actor_user_id = EXCLUDED.actor_user_id,
    action = EXCLUDED.action,
    from_status = EXCLUDED.from_status,
    to_status = EXCLUDED.to_status,
    detail = EXCLUDED.detail,
    create_time = EXCLUDED.create_time;

INSERT INTO support_conversation_audit (id, conversation_id, actor_user_id, action, from_status, to_status, detail, create_time)
VALUES (
    988403,
    988102,
    2008,
    'TRANSFERRED',
    NULL,
    'WAITING_AGENT',
    '默认待处理队列演示：用户请求人工客服核查主办方退款处理进度',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes'
)
ON CONFLICT (id) DO UPDATE
SET conversation_id = EXCLUDED.conversation_id,
    actor_user_id = EXCLUDED.actor_user_id,
    action = EXCLUDED.action,
    from_status = EXCLUDED.from_status,
    to_status = EXCLUDED.to_status,
    detail = EXCLUDED.detail,
    create_time = EXCLUDED.create_time;

INSERT INTO support_quick_reply (category, title, content, status, sort_order, create_time)
VALUES
('上下文', '用户上下文核查', '您好，我已打开用户上下文，会同时核对订单、退款、票夹、候补、抢票和通知记录。', 1, 5, CURRENT_TIMESTAMP),
('退款', '退款异常核查', '您好，退款异常需要结合订单号、退款单号和渠道结果核查，我会先确认站内记录再同步处理结果。', 1, 15, CURRENT_TIMESTAMP);

WITH operator_account AS (
    SELECT id AS operator_id
    FROM "user"
    WHERE phone = '13910000004'
      AND role = 'organizer_admin'
    LIMIT 1
),
assignment_seed AS (
    SELECT *
    FROM (VALUES
        (2003::BIGINT, 'normal'::VARCHAR, 'active'::VARCHAR, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 days'),
        (2005::BIGINT, 'watch'::VARCHAR, 'pending_material'::VARCHAR, CURRENT_TIMESTAMP + INTERVAL '1 days', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
        (2006::BIGINT, 'high'::VARCHAR, 'restricted'::VARCHAR, CURRENT_TIMESTAMP + INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
        (2007::BIGINT, 'normal'::VARCHAR, 'inactive'::VARCHAR, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
    ) AS seed(organizer_user_id, risk_level, status, next_follow_at, last_follow_at)
)
INSERT INTO organizer_ops_assignment (
    organizer_user_id,
    assigned_operator_id,
    risk_level,
    status,
    next_follow_at,
    last_follow_at,
    create_time,
    update_time
)
SELECT
    seed.organizer_user_id,
    operator_account.operator_id,
    seed.risk_level,
    seed.status,
    seed.next_follow_at,
    seed.last_follow_at,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM assignment_seed seed
CROSS JOIN operator_account
ON CONFLICT (organizer_user_id) DO UPDATE
SET assigned_operator_id = EXCLUDED.assigned_operator_id,
    risk_level = EXCLUDED.risk_level,
    status = EXCLUDED.status,
    next_follow_at = EXCLUDED.next_follow_at,
    last_follow_at = EXCLUDED.last_follow_at,
    update_time = CURRENT_TIMESTAMP;

WITH operator_account AS (
    SELECT id AS operator_id
    FROM "user"
    WHERE phone = '13910000004'
      AND role = 'organizer_admin'
    LIMIT 1
),
follow_seed AS (
    SELECT *
    FROM (VALUES
        (2003::BIGINT, 'phone'::VARCHAR, 'real-demo: 已电话确认年度演出排期，后续关注上海站库存节奏。'::TEXT, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 days'),
        (2005::BIGINT, 'material'::VARCHAR, 'real-demo: 场馆授权书缺少盖章页，已要求主办方补传材料。'::TEXT, CURRENT_TIMESTAMP + INTERVAL '1 days', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
        (2006::BIGINT, 'risk'::VARCHAR, 'real-demo: 退款异常和库存同步异常同时出现，已限制新增活动并进入风险复核。'::TEXT, CURRENT_TIMESTAMP + INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
        (2007::BIGINT, 'note'::VARCHAR, 'real-demo: 亲子展览主办方近期无新增活动，暂停日常跟进。'::TEXT, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
    ) AS seed(organizer_user_id, follow_type, content, next_follow_at, create_time)
)
INSERT INTO organizer_ops_follow_up (
    organizer_user_id,
    operator_id,
    follow_type,
    content,
    next_follow_at,
    create_time
)
SELECT
    seed.organizer_user_id,
    operator_account.operator_id,
    seed.follow_type,
    seed.content,
    seed.next_follow_at,
    seed.create_time
FROM follow_seed seed
CROSS JOIN operator_account;

INSERT INTO exception_task (id, task_type, business_no, order_no, payment_no, refund_no, ticket_no, severity, status, reason, result, operator_id, operator_role, trace_id, create_time, update_time) VALUES
(986001, 'PAYMENT_TIMEOUT', 'DMREAL980030', 'DMREAL980030', 'PAYREAL984030', NULL, NULL, 'high', 'pending', '支付超时订单已取消，等待库存释放确认', NULL, NULL, NULL, 'real-demo-trace-1', CURRENT_TIMESTAMP - INTERVAL '1 hours', CURRENT_TIMESTAMP),
(986002, 'REFUND_UNKNOWN', 'DMREAL980045', 'DMREAL980045', NULL, 'REFREAL985001', NULL, 'high', 'pending', '退款异常，渠道返回 UNKNOWN，需要人工查询', NULL, NULL, NULL, 'real-demo-trace-2', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP),
(986003, 'TICKET_ISSUE', 'DMREAL980010', 'DMREAL980010', NULL, NULL, 'ETREAL983001', 'medium', 'pending', '电子票生成延迟，需补偿重试', NULL, NULL, NULL, 'real-demo-trace-3', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP),
(986004, 'STOCK_SYNC', 'ACT-900001', NULL, NULL, NULL, NULL, 'medium', 'pending', '库存不足与候补分配数量不一致', NULL, NULL, NULL, 'real-demo-trace-4', CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP),
(986005, 'RISK_REVIEW', 'ACT-900001', NULL, NULL, NULL, NULL, 'high', 'pending', '风控命中活动申请恢复售票待审核', NULL, NULL, NULL, 'real-demo-trace-5', CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP),
(986006, 'RECONCILE_DIFF', 'REAL-DEMO-20260603', NULL, NULL, NULL, NULL, 'medium', 'resolved', '日结对账存在金额差异', '已完成差异复核', 2002, 'admin', 'real-demo-trace-6', CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, result = EXCLUDED.result, update_time = EXCLUDED.update_time;

INSERT INTO reconciliation_batch (id, batch_no, biz_date, source_type, status, summary_json, create_time, update_time) VALUES
(986101, 'REAL-DEMO-20260603', DATE '2026-06-03', 'local', 'generated', '{"paidOrderCount":38,"refundAbnormalCount":4,"diffCount":2}', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP)
ON CONFLICT (batch_no) DO UPDATE SET status = EXCLUDED.status, summary_json = EXCLUDED.summary_json, update_time = EXCLUDED.update_time;

INSERT INTO reconciliation_detail (batch_no, business_no, business_type, expected_amount, actual_amount, status, create_time) VALUES
('REAL-DEMO-20260603', 'DMREAL980001', 'ORDER', 950.00, 950.00, 'matched', CURRENT_TIMESTAMP),
('REAL-DEMO-20260603', 'DMREAL980045', 'REFUND', 270.00, 0.00, 'different', CURRENT_TIMESTAMP);

INSERT INTO reconciliation_difference (batch_no, diff_type, business_no, expected_amount, actual_amount, diff_amount, reason, status, create_time) VALUES
('REAL-DEMO-20260603', 'REFUND_AMOUNT_MISMATCH', 'DMREAL980045', 270.00, 0.00, 270.00, '退款异常，渠道结果未知', 'open', CURRENT_TIMESTAMP);

INSERT INTO operation_audit_log (id, operator_id, operator_role, action, target_type, target_id, target_ref, reason, result, success, trace_id, create_time) VALUES
(987001, 2002, 'admin', 'ACTIVITY_PUBLISH', 'activity', 900001, '活动发布管理', '发布真实演示活动', '操作成功', TRUE, 'real-demo-audit-1', CURRENT_TIMESTAMP - INTERVAL '8 hours'),
(987002, 2002, 'admin', 'TOUR_DRAFT_UPDATE', 'tour', 904001, '活动发布/多站点草稿', '更新多站点草稿', '操作成功', TRUE, 'real-demo-audit-2', CURRENT_TIMESTAMP - INTERVAL '7 hours'),
(987003, 2002, 'admin', 'ARTIST_REVIEW', 'artist', 901001, '艺人档案审核', '通过艺人档案审核', '操作成功', TRUE, 'real-demo-audit-3', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(987004, 2002, 'admin', 'RISK_RESOLUTION_REVIEW', 'activity', 900001, '恢复售票审核', '恢复售票审核通过', '操作成功', TRUE, 'real-demo-audit-4', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
(987005, 2002, 'admin', 'RISK_CASE_UPDATE', 'activity', 900001, '风险案例管理', '记录风控处置', '操作成功', TRUE, 'real-demo-audit-5', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
(987006, 2002, 'admin', 'VENUE_REVIEW', 'venue_application', 906001, '场馆资料审核', '场馆资料审核待处理', '操作成功', TRUE, 'real-demo-audit-6', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
(987007, 2002, 'admin', 'STATION_CONFIG_REVIEW', 'station_config_version', 907001, '站点变更审核', '审核站点变更', '操作成功', TRUE, 'real-demo-audit-7', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
(987008, 2002, 'admin', 'EXCEPTION_RESOLVE', 'exception_task', 986006, '异常任务', '处理异常任务', '操作成功', TRUE, 'real-demo-audit-8', CURRENT_TIMESTAMP - INTERVAL '1 hours')
ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, result = EXCLUDED.result, success = EXCLUDED.success;

WITH operator_account AS (
    SELECT id AS operator_id
    FROM "user"
    WHERE phone = '13910000004'
      AND role = 'organizer_admin'
    LIMIT 1
),
audit_seed AS (
    SELECT *
    FROM (VALUES
        (987009::BIGINT, 'organizer_ops.assignment.update'::VARCHAR, 'organizer_ops_assignment'::VARCHAR, 2005::BIGINT, 'watch'::VARCHAR, '更新主办方运营分配'::TEXT, '已分配城市剧场联盟并标记观察风险'::TEXT, 'real-demo-ops-audit-1'::VARCHAR, CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
        (987010::BIGINT, 'organizer_ops.follow_up.create'::VARCHAR, 'organizer_ops_follow_up'::VARCHAR, 2005::BIGINT, 'material'::VARCHAR, '新增主办方跟进记录'::TEXT, '记录材料补充跟进'::TEXT, 'real-demo-ops-audit-2'::VARCHAR, CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
        (987011::BIGINT, 'organizer_ops.assignment.update'::VARCHAR, 'organizer_ops_assignment'::VARCHAR, 2006::BIGINT, 'high'::VARCHAR, '更新主办方运营分配'::TEXT, '已分配运动赛事运营并标记高风险'::TEXT, 'real-demo-ops-audit-3'::VARCHAR, CURRENT_TIMESTAMP - INTERVAL '35 minutes'),
        (987012::BIGINT, 'organizer_ops.follow_up.create'::VARCHAR, 'organizer_ops_follow_up'::VARCHAR, 2006::BIGINT, 'risk'::VARCHAR, '新增主办方跟进记录'::TEXT, '记录风险复核跟进'::TEXT, 'real-demo-ops-audit-4'::VARCHAR, CURRENT_TIMESTAMP - INTERVAL '30 minutes')
    ) AS seed(id, action, target_type, target_id, target_ref, reason, result, trace_id, create_time)
)
INSERT INTO operation_audit_log (
    id,
    operator_id,
    operator_role,
    action,
    target_type,
    target_id,
    target_ref,
    reason,
    result,
    success,
    trace_id,
    create_time
)
SELECT
    seed.id,
    operator_account.operator_id,
    'organizer_admin',
    seed.action,
    seed.target_type,
    seed.target_id,
    seed.target_ref,
    seed.reason,
    seed.result,
    TRUE,
    seed.trace_id,
    seed.create_time
FROM audit_seed seed
CROSS JOIN operator_account
ON CONFLICT (id) DO UPDATE
SET operator_id = EXCLUDED.operator_id,
    operator_role = EXCLUDED.operator_role,
    action = EXCLUDED.action,
    target_type = EXCLUDED.target_type,
    target_id = EXCLUDED.target_id,
    target_ref = EXCLUDED.target_ref,
    reason = EXCLUDED.reason,
    result = EXCLUDED.result,
    success = EXCLUDED.success,
    trace_id = EXCLUDED.trace_id,
    create_time = EXCLUDED.create_time;

SELECT setval('user_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM "user"), 1), 1), true);
SELECT setval('exception_task_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM exception_task), 1), 1), true);
SELECT setval('support_conversation_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM support_conversation), 1), 1), true);
SELECT setval('support_message_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM support_message), 1), 1), true);
SELECT setval('support_conversation_note_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM support_conversation_note), 1), 1), true);
SELECT setval('support_conversation_audit_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM support_conversation_audit), 1), 1), true);
SELECT setval('support_quick_reply_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM support_quick_reply), 1), 1), true);
SELECT setval('organizer_ops_follow_up_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM organizer_ops_follow_up), 1), 1), true);
SELECT setval('operation_audit_log_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM operation_audit_log), 1), 1), true);
COMMIT;
