# Team Grab Planning Findings

## Existing Grab-Service Shape

- `grab_request.request_type` already allows `NORMAL_GRAB`, `TEAM_GRAB`, and `WAITLIST_OFFER`.
- `GrabRequestRecord.requestType` is already typed with `TEAM_GRAB`.
- Current worker path assumes a user-owned normal grab and calls order-service with `userId`, `quantity`, `seatIds`, and downgrade metadata.
- Redis queue and idempotency infrastructure exists for normal requests, but team-level idempotency still needs a separate key such as `grab:team:{teamId}:{sessionId}:{ticketTypeId}`.

## Existing Ticket-Service Shape

- `TicketSalesInternalService.lockSeats()` supports explicit seat ids and random allocation.
- There is no strategy-based group seat finder yet.
- `session_seat` has the required minimal fields for first version: `session_id`, `ticket_type_id`, `status`, `order_id`, `lock_expire_time`, `layout_section_id`, `row_no`, `seat_no`, `seat_label`, and `seat_block_id`.
- The first version can implement `STRICT_CONTIGUOUS`, `SAME_BLOCK`, and `SAME_TICKET_TYPE` using existing `session_seat` fields.

## Existing Order-Service Shape

- `OrderService.createOrderWithSeats()` already locks seats through ticket-service, creates `order_seat`, and writes order snapshots.
- `OrderService.markPaid()` confirms locked seats as sold.
- Pending order expiration and release flows already exist around `order_seat` status and `lock_expire_time`.
- Team order support should extend the seated order path instead of creating a parallel order flow.

## Product/Architecture Decisions

- Version 1 should use leader unified payment.
- Limit purchase by leader for version 1 to avoid cross-member purchase-limit accounting.
- Team seat assignment should be written after successful payment, when `order_seat` records are sold.
- Team lock must be triggered by any joined/confirmed member but must be fenced by team-level idempotency so concurrent clicks create one request.

## Plan Review Findings 2026-05-30

- Current workspace does have async grab queue, `grab-worker.service.ts`, `grab-queue.service.ts`, `ticket-client.service.ts`, and `request_type`; isolated-agent findings that said these files were missing were stale and should be ignored.
- The plan should add `requestType?: 'NORMAL_GRAB' | 'TEAM_GRAB' | 'WAITLIST_OFFER'` to `CreateQueuedGrabRequestInput`; the DB column already exists in `sql/production-split/grab/001_create_grab_request.sql` and `20260529_grab_progress_async_queue.sql`.
- `TicketSalesInternalService.lockTeamSeats()` must be explicitly `@Transactional(rollbackFor = Exception.class)` so `FOR UPDATE SKIP LOCKED` selection and update stay in one transaction.
- Adding `session_seat.lock_request_id` also requires adding `SessionSeat.lockRequestId`, clearing it in `releaseLockedSeat`, and adding a stale pre-order team-lock recovery path for seats locked before order creation.
- `java-order` currently cannot return per-seat labels from `order_seat`; the team order API must either store order-owned structured seat labels or return labels from team/order snapshot data passed at creation time, without cross-querying ticket DB.
- Frontend checks should use `pnpm typecheck` and `pnpm build`; grab-service checks should continue using `npm test`.
- Notification client can target existing internal endpoint `POST /api/notification/internal/messages` with `X-Internal-Token`.
- `sql/production-split/manifest.json` must be updated to include new grab/ticket/order migrations.
- Verified current code shape for the revision:
  - `SessionSeat.java` currently has no `lockRequestId`.
  - `SessionSeatMapper.releaseLockedSeat()` and `markSeatSold()` currently do not clear `lock_request_id` because the column does not exist yet.
  - `OrderSeat.java` currently has no `seatLabel`.
  - `CreateQueuedGrabRequestInput` currently has no `requestType`, while `GrabRequestRecord.requestType` already includes `NORMAL_GRAB | TEAM_GRAB | WAITLIST_OFFER`.

## Current Workspace Note

- There are existing uncommitted frontend changes from the previous browser-back fix:
  - `frontend/src/app/page.tsx`
  - `frontend/src/lib/home-resume-refresh.ts`
  - `frontend/src/lib/home-resume-refresh.test.ts`
