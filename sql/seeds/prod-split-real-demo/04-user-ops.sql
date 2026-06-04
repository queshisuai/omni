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

DELETE FROM exception_task WHERE id BETWEEN 986001 AND 986050;
DELETE FROM reconciliation_difference WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM reconciliation_detail WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM reconciliation_batch WHERE batch_no LIKE 'REAL-DEMO-%';
DELETE FROM operation_audit_log WHERE id BETWEEN 987001 AND 987050;

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

SELECT setval('user_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM "user"), 1), 1), true);
SELECT setval('exception_task_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM exception_task), 1), 1), true);
SELECT setval('operation_audit_log_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM operation_audit_log), 1), 1), true);
COMMIT;