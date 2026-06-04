-- 05-notification.sql
-- 本地 prod-split 真实演示 seed，仅供联调，不属于生产迁移。
-- target database: omni_notification


BEGIN;
DELETE FROM notification WHERE id BETWEEN 988001 AND 988050;
INSERT INTO notification (id, user_id, order_id, type, content, status, create_time, read_time, deleted_time, update_time, action_href, action_label, aggregate_key) VALUES
(988001, 2004, 980001, 'IN_APP', '订单已支付，电子票已生成，请在票夹查看。', 1, CURRENT_TIMESTAMP - INTERVAL '1 hours', CURRENT_TIMESTAMP - INTERVAL '0 hours', NULL, CURRENT_TIMESTAMP, '/orders/980001', '查看订单', 'REAL-DEMO:订单:0'),
(988002, 2008, 980045, 'IN_APP', '退款异常，平台客服正在人工核查渠道结果。', 1, CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL, NULL, CURRENT_TIMESTAMP, '/orders/980045', '查看退款', 'REAL-DEMO:退款:1'),
(988003, 2004, NULL, 'IN_APP', '候补成功转化，请在支付有效期内完成订单支付。', 1, CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL, NULL, CURRENT_TIMESTAMP, '/waitlist', '查看候补', 'REAL-DEMO:候补:2'),
(988004, 2003, NULL, 'IN_APP', '活动命中风控，请补充资料后提交恢复售票申请。', 1, CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL, CURRENT_TIMESTAMP, '/console/risk-cases', '查看风控', 'REAL-DEMO:风控:3'),
(988005, 2002, NULL, 'IN_APP', '场馆资料审核有新的待处理申请。', 1, CURRENT_TIMESTAMP - INTERVAL '5 hours', NULL, NULL, CURRENT_TIMESTAMP, '/console/venue/applications', '去审核', 'REAL-DEMO:场馆资料审核:4'),
(988006, 2002, NULL, 'IN_APP', '站点变更审核有新的待处理申请。', 1, CURRENT_TIMESTAMP - INTERVAL '6 hours', NULL, NULL, CURRENT_TIMESTAMP, '/console/station-config-reviews', '去审核', 'REAL-DEMO:站点变更审核:5'),
(988007, 2002, NULL, 'IN_APP', '异常任务待处理：支付、退款、出票、库存存在异常。', 1, CURRENT_TIMESTAMP - INTERVAL '7 hours', CURRENT_TIMESTAMP - INTERVAL '6 hours', NULL, CURRENT_TIMESTAMP, '/console/exception-tasks', '处理异常', 'REAL-DEMO:异常任务:6')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, update_time = EXCLUDED.update_time;

SELECT setval('notification_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM notification), 1), 1), true);
COMMIT;