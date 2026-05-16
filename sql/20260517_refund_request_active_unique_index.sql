-- 限制同一订单只能存在一条活跃退款申请；已拒绝/退款失败可再次申请。
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_order_active_unique
    ON refund_request(order_id)
    WHERE status IN (0, 1, 4);
