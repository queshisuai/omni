-- owner: java-payment

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refund_request_payment') THEN
        ALTER TABLE refund_request
            ADD CONSTRAINT fk_refund_request_payment
            FOREIGN KEY (payment_id) REFERENCES payment(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_order ON payment(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_no ON payment(payment_no);
CREATE INDEX IF NOT EXISTS idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_trade_no ON payment(trade_no);
CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_request(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_order_active_unique ON refund_request(order_id) WHERE status IN (0, 1, 4);
CREATE INDEX IF NOT EXISTS idx_refund_user ON refund_request(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_request(status);
CREATE INDEX IF NOT EXISTS idx_refund_no ON refund_request(refund_no);
