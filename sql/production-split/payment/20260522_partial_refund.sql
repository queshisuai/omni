-- owner: java-payment

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS order_seat_ids VARCHAR(500);

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS refund_type VARCHAR(32) DEFAULT 'full';

UPDATE refund_request
SET refund_type = 'full'
WHERE refund_type IS NULL;

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_quantity_positive;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_quantity_positive
    CHECK (quantity IS NULL OR quantity > 0);

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_refund_type;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_refund_type
    CHECK (refund_type IN ('full', 'partial'));
