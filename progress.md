# Team Grab Planning Progress

## 2026-05-30

- Received product requirements for team grab as a transaction orchestration layer.
- Read existing root planning files and confirmed they were for an older Feign API refactor plan.
- Inspected current grab-service queue, request type, worker, order client, and repository model.
- Inspected ticket-service internal lock seat implementation and `SessionSeatMapper`.
- Inspected order-service create-with-seats, payment confirmation, order-seat, and release flows.
- Decided the implementation plan should build team grab on top of existing async grab-service and seated order flow.
- Preparing detailed plan at `docs/superpowers/plans/2026-05-30-team-grab.md`.
- Created `docs/superpowers/plans/2026-05-30-team-grab.md`.
- Self-reviewed the plan for placeholder markers and acceptance-criteria coverage.
- Reviewed the saved plan against current code and graph context; key supplements are transaction boundary for team seat locking, `lock_request_id` entity/release/recovery coverage, order-owned per-seat label storage, migration manifest updates, and pnpm frontend command alignment.
- Updated `docs/superpowers/plans/2026-05-30-team-grab.md` with the review corrections: team status mapping, explicit `@Transactional` requirement, `SessionSeat.lockRequestId`, release/mark-sold cleanup, stale pre-order lock recovery, `order_seat.seat_label`, production manifest updates, notification endpoint path, `CreateQueuedGrabRequestInput.requestType`, order timeout retry rules, and `pnpm` frontend verification commands.
