-- owner: java-order

ALTER TABLE order_seat
    ADD CONSTRAINT fk_order_seat_order
    FOREIGN KEY (order_id) REFERENCES "order"(id);

ALTER TABLE order_snapshot
    ADD CONSTRAINT fk_order_snapshot_order
    FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_user ON "order"(user_id);
CREATE INDEX IF NOT EXISTS idx_order_no ON "order"(order_no);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_seat_order ON order_seat(order_id);
CREATE INDEX IF NOT EXISTS idx_order_seat_session_seat ON order_seat(session_seat_id);
CREATE INDEX IF NOT EXISTS idx_order_seat_status ON order_seat(status);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_snapshot(session_id);
