-- 本文件仅用于本地 disposable database / schema isolation 实验。
-- 禁止用于 staging / production，禁止接入生产迁移流程。
-- 执行前必须备份或重建本地 omni_ticket 数据库。
-- 本文件只删除 docs/microservices/cross-service-db-constraints.md 中已登记的 cross-owner FK。
-- 本文件不删除 same-owner FK，不删除 legacy 表本身，不删除 order_snapshot.order_id -> "order"(id)。
--
-- 说明：当前多数历史建表语句未显式命名外键约束，下面使用 PostgreSQL 默认命名规则
-- <table>_<column>_fkey 作为本地候选名。执行前建议在本地库使用 \d 表名 或查询
-- pg_constraint 确认实际 constraint 名称。

BEGIN;

-- java-ticket.venue_application.applicant_id -> java-user."user"(id)
-- 场馆申请人是 user-owned 标识；schema isolation 时应作为 copied id，由 java-ticket 调 java-user 校验。
ALTER TABLE venue_application DROP CONSTRAINT IF EXISTS venue_application_applicant_id_fkey;

-- java-ticket.venue_application.reviewer_id -> java-user."user"(id)
-- 场馆审核人是 user-owned 标识；schema isolation 时应作为 copied reviewer id。
ALTER TABLE venue_application DROP CONSTRAINT IF EXISTS venue_application_reviewer_id_fkey;

-- java-ticket.activity.organizer_id -> java-user."user"(id)
-- 活动主办方是 user-owned 标识；运行时通过 java-user internal API 校验 organizer 角色/状态。
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_organizer_id_fkey;

-- java-order."order".user_id -> java-user."user"(id)
-- 订单用户是 user-owned 标识；运行时由 java-order 调 java-user internal API 校验。
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_user_id_fkey;

-- java-order."order".session_id -> java-ticket.session(id)
-- 订单场次是 ticket-owned 标识；运行时由 java-order 调 java-ticket quote/lock API 校验。
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_session_id_fkey;

-- java-order."order".ticket_type_id -> java-ticket.ticket_type(id)
-- 订单票档是 ticket-owned 标识；运行时由 java-order 调 java-ticket quote/lock API 校验。
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_ticket_type_id_fkey;

-- java-order.order_seat.session_seat_id -> java-ticket.session_seat(id)
-- 订单座位是 ticket-owned 标识；运行时由 java-order 调 java-ticket seat lock/confirm API 协调。
ALTER TABLE order_seat DROP CONSTRAINT IF EXISTS order_seat_session_seat_id_fkey;

-- java-ticket.session_seat.order_id -> java-order."order"(id)
-- 票务座位锁定记录引用 order-owned 标识；schema isolation 时应作为 copied order id。
ALTER TABLE session_seat DROP CONSTRAINT IF EXISTS session_seat_order_id_fkey;

-- java-payment.payment.order_id -> java-order."order"(id)
-- 支付流水引用 order-owned 标识；运行时由 java-payment 调 java-order internal API 校验订单。
ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_order_id_fkey;

-- java-payment.refund_request.order_id -> java-order."order"(id)
-- 退款申请引用 order-owned 标识；运行时由 java-payment 调 java-order internal API 加载/校验订单。
ALTER TABLE refund_request DROP CONSTRAINT IF EXISTS refund_request_order_id_fkey;

-- java-payment.refund_request.user_id -> java-user."user"(id)
-- 退款申请人是 user-owned 标识；来源于订单/登录上下文，schema isolation 时作为 copied id。
ALTER TABLE refund_request DROP CONSTRAINT IF EXISTS refund_request_user_id_fkey;

-- java-payment.refund_request.reviewer_id -> java-user."user"(id)
-- 退款审核人是 user-owned 标识；运行时由 java-payment 调 java-user internal API 校验权限。
ALTER TABLE refund_request DROP CONSTRAINT IF EXISTS refund_request_reviewer_id_fkey;

-- java-notification.notification.user_id -> java-user."user"(id)
-- 通知收件人是 copied user id；notification 不拥有用户数据，不做本地 FK 校验。
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_user_id_fkey;

-- java-notification.notification.order_id -> java-order."order"(id)
-- 通知关联订单是 copied order id；notification 不拥有订单数据，不做本地 FK 校验。
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_order_id_fkey;

-- java-ticket.stock_log.order_id -> java-order."order"(id)
-- 库存流水中的订单号用于审计关联；schema isolation 时应作为 copied order id 或重新划分审计归属。
ALTER TABLE stock_log DROP CONSTRAINT IF EXISTS stock_log_order_id_fkey;

-- legacy-unused: reservation.user_id -> java-user."user"(id)
-- reservation 属历史路径；本地 schema isolation 可移除跨 owner FK，但不删除 reservation 表。
ALTER TABLE reservation DROP CONSTRAINT IF EXISTS reservation_user_id_fkey;

-- legacy-unused: review.user_id -> java-user."user"(id)
-- review 属已移除功能；本地 schema isolation 可移除跨 owner FK，但不删除 review 表。
ALTER TABLE review DROP CONSTRAINT IF EXISTS review_user_id_fkey;

-- legacy-unused: review.order_id -> java-order."order"(id)
-- review 属已移除功能；本地 schema isolation 可移除跨 owner FK，但不删除 review 表。
ALTER TABLE review DROP CONSTRAINT IF EXISTS review_order_id_fkey;

-- legacy-unused: moment.user_id -> java-user."user"(id)
-- moment 属已移除功能；本地 schema isolation 可移除跨 owner FK，但不删除 moment 表。
ALTER TABLE moment DROP CONSTRAINT IF EXISTS moment_user_id_fkey;

COMMIT;
