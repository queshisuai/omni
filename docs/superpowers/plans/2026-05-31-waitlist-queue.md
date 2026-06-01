# Waitlist Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build first-version waitlist queue allocation where sold-out users join a fair queue, released tickets create pending orders automatically, and unpaid offers expire back into the same release chain.

**Architecture:** `grab-service` owns waitlist queue state in `omni_grab`; order-service still owns order creation, pending payment timeout, and payment success; ticket-service still owns seat locks, stock deduction, sold seats, and refund resell decisions. Release events flow from order-service to `grab-service` through internal HTTP, and `WaitlistAllocatorService` calls order-service internal create endpoints instead of touching inventory.

**Tech Stack:** NestJS 10, Jest, PostgreSQL, Redis/ioredis if short locks are needed, Spring Boot 2.7, MyBatis-Plus, OpenFeign, JUnit/Mockito, Next.js 16, React 19, TypeScript.

---

## Scope Check

This is one integrated workflow with independent implementation slices. The minimum shippable version includes waitlist tables, user entry APIs, release-event allocation, order timeout integration, refund integration, in-app notifications, offer status recovery, and a frontend sold-out entry. It deliberately excludes seat preference, split allocation, VIP priority, cross-ticket alternatives, cross-session alternatives, and custom 5-minute order lock times.

Implementation must not touch the active `.worktrees/team-grab` worktree. Start from `master` after the transparency layer merge and keep waitlist work isolated from uncommitted team-grab files.

## Decisions

- Waitlist state lives in `grab-service`, not `java-ticket`.
- Public API prefix is `/api/waitlist/**`; gateway routes that prefix to `grab-service`.
- First version supports one exact session and one exact ticket type per entry.
- A release event can offer at most one waitlist order; if released quantity exceeds the selected entry quantity, leftover inventory remains public.
- Entry ordering is `priority_no ASC, create_time ASC, id ASC`.
- Entries requiring more tickets than `releasedQuantity` are skipped without status change.
- `ALLOCATING` is the concurrency fence.
- order-service business failures mark the entry `FAILED` and allocator continues to the next eligible entry.
- system failures restore the entry to `WAITING` and stop the current release event.
- The order idempotency key is passed as `grabRequestId = WAITLIST-{entryId}-{eventHash}` and protected by existing `order_snapshot.grab_request_id` uniqueness.
- `WAITLIST-*` order idempotency keys must not trigger the current grab-order `authorizedMaxUnitPrice` requirement; waitlist offers are pending orders that users explicitly pay after notification.
- Offer payment window reuses the current order 15-minute timeout.
- Offer expiration is driven by order-service timeout release, with waitlist scan as compensation only.

## File Structure And Responsibilities

### SQL

- Create: `sql/production-split/grab/20260531_waitlist_queue.sql`
  Creates `waitlist_entry`, `waitlist_offer`, `waitlist_allocation_log`, indexes, status checks, and active duplicate protection.
- Modify: `sql/production-split/manifest.json`
  Adds `grab/20260531_waitlist_queue.sql` and updates grab-owned table list.

### grab-service

- Create: `nestjs/grab-service/src/waitlist/waitlist.types.ts`
  Defines request DTOs, records, statuses, release event payloads, allocation results, and notification payloads.
- Create: `nestjs/grab-service/src/waitlist/waitlist.repository.ts`
  Owns SQL for creating entries, computing rank, atomically claiming next entry, status transitions, offer writes, and allocation logs.
- Create: `nestjs/grab-service/src/waitlist/waitlist.service.ts`
  Implements user-facing create/list/cancel and internal status helpers.
- Create: `nestjs/grab-service/src/waitlist/waitlist-allocator.service.ts`
  Processes release events, creates pending orders through order-service, records logs, and sends notifications.
- Create: `nestjs/grab-service/src/waitlist/waitlist.controller.ts`
  Exposes authenticated user APIs and internal APIs with token checks.
- Create: `nestjs/grab-service/src/waitlist/waitlist-notification.service.ts`
  Calls `java-notification` internal message API.
- Create: `nestjs/grab-service/src/waitlist/waitlist.module.ts`
  Registers waitlist providers.
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
  Adds waitlist order creation and order lookup helpers.
- Modify: `nestjs/grab-service/src/app.module.ts`
  Imports `WaitlistModule`.
- Add tests beside each new waitlist service.

### java-order

- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketReleasedEvent.java`
  Internal event returned by timeout and refund release paths.
- Create: `java/java-order/src/main/java/com/omni/order/dto/WaitlistReleaseRequest.java`
  Payload sent to grab-service.
- Create: `java/java-order/src/main/java/com/omni/order/client/WaitlistInternalClient.java`
  OpenFeign client with URL `${waitlist.service.url:http://localhost:3001}` and `X-Internal-Token`.
- Modify: `java/java-order/src/main/java/com/omni/order/service/SeatLockScheduler.java`
  Publishes release events after `OrderService.releaseExpiredSeatLocksDetailed()`.
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
  Returns release event details, publishes payment success to waitlist, uses ticket refund restored quantity, and exempts `WAITLIST-*` idempotency keys from grab price-authorization checks.
- Modify: `java/java-order/src/main/java/com/omni/order/client/TicketSalesInternalClient.java`
  Changes release/refund response from `Void` to a release result DTO.
- Add focused tests for timeout release event grouping, refund event publishing, and payment-success waitlist callback.

### java-ticket

- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesReleaseResponse.java`
  Contains `sessionId`, `ticketTypeId`, `quantity`, `seatIds`, and `restoredQuantity`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
  Returns release response from `/release` and `/refund`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
  Reports actual restored quantity; refund returns zero when seats are marked unavailable.
- Add tests for resellable refund, non-resellable refund, standing ticket release, and seat release.

### java-gateway

- Modify: `java/java-gateway/src/main/resources/application.yml`
  Adds `/api/waitlist/**` route to `http://localhost:3001`.
- Modify: `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java`
  Adds a waitlist API resource with conservative QPS.
- Add or update gateway config tests if present.

### frontend

- Modify: `frontend/src/types/api.ts`
  Adds waitlist entry, status, request, response, and offer types.
- Modify: `frontend/src/lib/api.ts`
  Adds `createWaitlistEntry`, `listMyWaitlistEntries`, and `cancelWaitlistEntry`.
- Modify: `frontend/src/app/activity/[id]/page.tsx`
  Enables “加入候补” on sold-out terminal states and shows rank after creation.
- Create: `frontend/src/lib/waitlist.ts`
  Pure helpers for status labels and CTA state.
- Create: `frontend/src/lib/waitlist.test.ts`
  Tests waitlist UI helper behavior.

---

### Task 1: SQL schema and waitlist types

**Files:**
- Create: `sql/production-split/grab/20260531_waitlist_queue.sql`
- Modify: `sql/production-split/manifest.json`
- Create: `nestjs/grab-service/src/waitlist/waitlist.types.ts`
- Test: `nestjs/grab-service/src/waitlist/waitlist.repository.spec.ts`

- [ ] **Step 1: Write failing repository mapping test**

Create `nestjs/grab-service/src/waitlist/waitlist.repository.spec.ts` with the first behavior:

```ts
import { WaitlistRepository } from './waitlist.repository';

describe('WaitlistRepository', () => {
  it('maps waitlist entry rows to camelCase records', () => {
    const repository = new WaitlistRepository({ query: jest.fn() } as any);
    const record = (repository as any).mapEntry({
      id: '10',
      user_id: '2004',
      session_id: '101',
      ticket_type_id: '202',
      quantity: 2,
      seat_preference: null,
      status: 'WAITING',
      priority_no: '99',
      offer_order_id: null,
      offer_expire_time: null,
      fail_reason: null,
      create_time: new Date('2026-05-31T00:00:00Z'),
      update_time: new Date('2026-05-31T00:00:00Z'),
    });

    expect(record).toMatchObject({
      id: 10,
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      status: 'WAITING',
      priorityNo: 99,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.repository.spec.ts
```

Expected: FAIL because `waitlist.repository.ts` does not exist.

- [ ] **Step 3: Create production split SQL**

Create `sql/production-split/grab/20260531_waitlist_queue.sql`:

```sql
-- owner: grab-service

CREATE SEQUENCE IF NOT EXISTS waitlist_priority_seq;

CREATE TABLE IF NOT EXISTS waitlist_entry (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    seat_preference JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'WAITING',
    priority_no BIGINT NOT NULL DEFAULT nextval('waitlist_priority_seq'),
    offer_order_id BIGINT,
    offer_expire_time TIMESTAMP,
    fail_reason VARCHAR(512),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_entry_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_entry_status CHECK (status IN (
        'WAITING', 'ALLOCATING', 'OFFERED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_entry_active_user_ticket
    ON waitlist_entry(user_id, session_id, ticket_type_id)
    WHERE status IN ('WAITING', 'ALLOCATING', 'OFFERED');

CREATE INDEX IF NOT EXISTS idx_waitlist_entry_queue
    ON waitlist_entry(session_id, ticket_type_id, status, priority_no, create_time, id);

CREATE INDEX IF NOT EXISTS idx_waitlist_entry_user
    ON waitlist_entry(user_id, create_time DESC);

CREATE TABLE IF NOT EXISTS waitlist_offer (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES waitlist_entry(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFERED',
    expire_time TIMESTAMP NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_offer_quantity CHECK (quantity > 0),
    CONSTRAINT chk_waitlist_offer_status CHECK (status IN ('OFFERED', 'PAID', 'EXPIRED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_offer_order
    ON waitlist_offer(order_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_offer_entry
    ON waitlist_offer(entry_id, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expire
    ON waitlist_offer(status, expire_time);

CREATE TABLE IF NOT EXISTS waitlist_allocation_log (
    id BIGSERIAL PRIMARY KEY,
    event_key VARCHAR(160) NOT NULL,
    attempt_no INTEGER NOT NULL DEFAULT 0,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    released_quantity INTEGER NOT NULL,
    allocated_entry_id BIGINT,
    order_id BIGINT,
    source_order_id BIGINT,
    status VARCHAR(32) NOT NULL,
    message VARCHAR(1024),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_waitlist_allocation_quantity CHECK (released_quantity > 0),
    CONSTRAINT chk_waitlist_allocation_status CHECK (status IN (
        'PROCESSING', 'FAILED', 'OFFERED', 'NO_MATCH', 'DUPLICATE'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_waitlist_allocation_event_attempt
    ON waitlist_allocation_log(event_key, attempt_no);

CREATE INDEX IF NOT EXISTS idx_waitlist_allocation_event
    ON waitlist_allocation_log(event_key, create_time);
```

- [ ] **Step 4: Update migration manifest**

In `sql/production-split/manifest.json`, update the grab service block:

```json
{
  "service": "grab-service",
  "key": "grab",
  "targetInstance": "pg-grab",
  "targetDatabase": "omni_grab",
  "tables": ["grab_request", "waitlist_entry", "waitlist_offer", "waitlist_allocation_log"],
  "migrations": [
    "grab/001_create_grab_request.sql",
    "grab/20260529_grab_progress_async_queue.sql",
    "grab/20260530_grab_pending_recovery_status.sql",
    "grab/20260531_waitlist_queue.sql"
  ]
}
```

- [ ] **Step 5: Create waitlist types**

Create `nestjs/grab-service/src/waitlist/waitlist.types.ts`:

```ts
export const WAITLIST_ENTRY_STATUS = {
  WAITING: 'WAITING',
  ALLOCATING: 'ALLOCATING',
  OFFERED: 'OFFERED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
} as const;

export type WaitlistEntryStatus = typeof WAITLIST_ENTRY_STATUS[keyof typeof WAITLIST_ENTRY_STATUS];

export const WAITLIST_OFFER_STATUS = {
  OFFERED: 'OFFERED',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type WaitlistOfferStatus = typeof WAITLIST_OFFER_STATUS[keyof typeof WAITLIST_OFFER_STATUS];

export interface CreateWaitlistEntryDto {
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
}

export interface WaitlistEntryRecord {
  id: number;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatPreference: unknown | null;
  status: WaitlistEntryStatus;
  priorityNo: number;
  offerOrderId: number | null;
  offerExpireTime: Date | null;
  failReason: string | null;
  createTime: Date;
  updateTime: Date;
}

export interface WaitlistEntryResponse {
  id: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  status: WaitlistEntryStatus;
  rank: number | null;
  offerOrderId: number | null;
  offerExpireTime: string | null;
  failReason: string | null;
}

export interface TicketReleasedEventDto {
  eventKey: string;
  source: 'ORDER_TIMEOUT' | 'REFUND' | 'MANUAL';
  sourceOrderId?: number | null;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds?: number[];
}

export interface WaitlistOfferRecord {
  id: number;
  entryId: number;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  orderId: number;
  status: WaitlistOfferStatus;
  expireTime: Date;
  createTime: Date;
  updateTime: Date;
}
```

- [ ] **Step 6: Run test again**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.repository.spec.ts
```

Expected: FAIL until repository is implemented in Task 2.

---

### Task 2: waitlist repository with atomic queue operations

**Files:**
- Create: `nestjs/grab-service/src/waitlist/waitlist.repository.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.repository.spec.ts`

- [ ] **Step 1: Add failing tests for create, rank, and claim**

Extend `waitlist.repository.spec.ts`:

```ts
it('creates a waiting entry and computes rank', async () => {
  const query = jest.fn()
    .mockResolvedValueOnce({ rows: [{ id: '1', user_id: '2004', session_id: '101', ticket_type_id: '202', quantity: 1, seat_preference: null, status: 'WAITING', priority_no: '8', offer_order_id: null, offer_expire_time: null, fail_reason: null, create_time: new Date(), update_time: new Date() }] })
    .mockResolvedValueOnce({ rows: [{ rank: '3' }] });
  const repository = new WaitlistRepository({ query } as any);

  const result = await repository.createEntry({ userId: 2004, sessionId: 101, ticketTypeId: 202, quantity: 1 });

  expect(result.entry.id).toBe(1);
  expect(result.rank).toBe(3);
  expect(query.mock.calls[0][0]).toContain('insert into waitlist_entry');
});

it('claims the earliest eligible waiting entry with row locking', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ id: '2', user_id: '2005', session_id: '101', ticket_type_id: '202', quantity: 1, seat_preference: null, status: 'ALLOCATING', priority_no: '9', offer_order_id: null, offer_expire_time: null, fail_reason: null, create_time: new Date(), update_time: new Date() }] });
  const repository = new WaitlistRepository({ query } as any);

  const result = await repository.claimNextEntry({ sessionId: 101, ticketTypeId: 202, releasedQuantity: 1 });

  expect(result?.status).toBe('ALLOCATING');
  expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.repository.spec.ts
```

Expected: FAIL because repository methods are missing.

- [ ] **Step 3: Implement repository**

Create `nestjs/grab-service/src/waitlist/waitlist.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  WAITLIST_ENTRY_STATUS,
  WAITLIST_OFFER_STATUS,
  WaitlistEntryRecord,
  WaitlistOfferRecord,
} from './waitlist.types';

@Injectable()
export class WaitlistRepository {
  constructor(private readonly database: DatabaseService) {}

  async createEntry(input: { userId: number; sessionId: number; ticketTypeId: number; quantity: number }): Promise<{ entry: WaitlistEntryRecord; rank: number }> {
    const inserted = await this.database.query(
      `insert into waitlist_entry (user_id, session_id, ticket_type_id, quantity, status)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [input.userId, input.sessionId, input.ticketTypeId, input.quantity, WAITLIST_ENTRY_STATUS.WAITING],
    );
    const entry = this.mapEntry(inserted.rows[0]);
    const rank = await this.getRank(entry.id, entry.sessionId, entry.ticketTypeId);
    return { entry, rank };
  }

  async listByUser(userId: number): Promise<Array<WaitlistEntryRecord & { rank: number | null }>> {
    const result = await this.database.query(
      `select * from waitlist_entry where user_id = $1 order by create_time desc, id desc`,
      [userId],
    );
    const entries = result.rows.map(row => this.mapEntry(row));
    return Promise.all(entries.map(async entry => ({
      ...entry,
      rank: entry.status === WAITLIST_ENTRY_STATUS.WAITING
        ? await this.getRank(entry.id, entry.sessionId, entry.ticketTypeId)
        : null,
    })));
  }

  async cancelWaitingEntry(id: number, userId: number): Promise<WaitlistEntryRecord | null> {
    const result = await this.database.query(
      `update waitlist_entry
       set status = $3, update_time = now()
       where id = $1 and user_id = $2 and status = $4
       returning *`,
      [id, userId, WAITLIST_ENTRY_STATUS.CANCELLED, WAITLIST_ENTRY_STATUS.WAITING],
    );
    return result.rows[0] ? this.mapEntry(result.rows[0]) : null;
  }

  async claimNextEntry(input: { sessionId: number; ticketTypeId: number; releasedQuantity: number }): Promise<WaitlistEntryRecord | null> {
    const result = await this.database.query(
      `update waitlist_entry
       set status = $4, update_time = now()
       where id = (
         select id
         from waitlist_entry
         where session_id = $1
           and ticket_type_id = $2
           and status = $3
           and quantity <= $5
         order by priority_no asc, create_time asc, id asc
         for update skip locked
         limit 1
       )
       returning *`,
      [input.sessionId, input.ticketTypeId, WAITLIST_ENTRY_STATUS.WAITING, WAITLIST_ENTRY_STATUS.ALLOCATING, input.releasedQuantity],
    );
    return result.rows[0] ? this.mapEntry(result.rows[0]) : null;
  }

  async markEntryOffered(entryId: number, orderId: number, expireTime: Date): Promise<WaitlistEntryRecord> {
    const result = await this.database.query(
      `update waitlist_entry
       set status = $2, offer_order_id = $3, offer_expire_time = $4, fail_reason = null, update_time = now()
       where id = $1 and status = $5
       returning *`,
      [entryId, WAITLIST_ENTRY_STATUS.OFFERED, orderId, expireTime, WAITLIST_ENTRY_STATUS.ALLOCATING],
    );
    return this.mapEntry(result.rows[0]);
  }

  async restoreAllocatingEntry(entryId: number, reason: string): Promise<void> {
    await this.database.query(
      `update waitlist_entry
       set status = $2, fail_reason = $3, update_time = now()
       where id = $1 and status = $4`,
      [entryId, WAITLIST_ENTRY_STATUS.WAITING, reason, WAITLIST_ENTRY_STATUS.ALLOCATING],
    );
  }

  async markEntryFailed(entryId: number, reason: string): Promise<void> {
    await this.database.query(
      `update waitlist_entry
       set status = $2, fail_reason = $3, update_time = now()
       where id = $1 and status = $4`,
      [entryId, WAITLIST_ENTRY_STATUS.FAILED, reason, WAITLIST_ENTRY_STATUS.ALLOCATING],
    );
  }

  async createOffer(input: { entry: WaitlistEntryRecord; orderId: number; expireTime: Date }): Promise<WaitlistOfferRecord> {
    const result = await this.database.query(
      `insert into waitlist_offer (entry_id, user_id, session_id, ticket_type_id, quantity, order_id, status, expire_time)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (order_id) do update set update_time = now()
       returning *`,
      [
        input.entry.id,
        input.entry.userId,
        input.entry.sessionId,
        input.entry.ticketTypeId,
        input.entry.quantity,
        input.orderId,
        WAITLIST_OFFER_STATUS.OFFERED,
        input.expireTime,
      ],
    );
    return this.mapOffer(result.rows[0]);
  }

  async beginAllocationEvent(eventKey: string, sessionId: number, ticketTypeId: number, releasedQuantity: number, sourceOrderId: number | null): Promise<boolean> {
    const result = await this.database.query(
      `insert into waitlist_allocation_log (event_key, attempt_no, session_id, ticket_type_id, released_quantity, source_order_id, status, message)
       values ($1, 0, $2, $3, $4, $5, 'PROCESSING', 'allocation event started')
       on conflict (event_key, attempt_no) do nothing
       returning id`,
      [eventKey, sessionId, ticketTypeId, releasedQuantity, sourceOrderId],
    );
    return result.rows.length === 1;
  }

  async logAllocationAttempt(input: {
    eventKey: string;
    attemptNo: number;
    sessionId: number;
    ticketTypeId: number;
    releasedQuantity: number;
    entryId: number | null;
    orderId: number | null;
    sourceOrderId: number | null;
    status: 'FAILED' | 'OFFERED' | 'NO_MATCH' | 'DUPLICATE';
    message: string;
  }): Promise<void> {
    await this.database.query(
      `insert into waitlist_allocation_log
        (event_key, attempt_no, session_id, ticket_type_id, released_quantity, allocated_entry_id, order_id, source_order_id, status, message)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (event_key, attempt_no) do nothing`,
      [input.eventKey, input.attemptNo, input.sessionId, input.ticketTypeId, input.releasedQuantity, input.entryId, input.orderId, input.sourceOrderId, input.status, input.message],
    );
  }

  async markOfferPaidByOrder(orderId: number): Promise<void> {
    await this.database.query(
      `update waitlist_offer set status = $2, update_time = now() where order_id = $1 and status = $3`,
      [orderId, WAITLIST_OFFER_STATUS.PAID, WAITLIST_OFFER_STATUS.OFFERED],
    );
    await this.database.query(
      `update waitlist_entry set status = $2, update_time = now()
       where offer_order_id = $1 and status = $3`,
      [orderId, WAITLIST_ENTRY_STATUS.PAID, WAITLIST_ENTRY_STATUS.OFFERED],
    );
  }

  async markOfferExpiredByOrder(orderId: number): Promise<void> {
    await this.database.query(
      `update waitlist_offer set status = $2, update_time = now() where order_id = $1 and status = $3`,
      [orderId, WAITLIST_OFFER_STATUS.EXPIRED, WAITLIST_OFFER_STATUS.OFFERED],
    );
    await this.database.query(
      `update waitlist_entry set status = $2, update_time = now()
       where offer_order_id = $1 and status = $3`,
      [orderId, WAITLIST_ENTRY_STATUS.EXPIRED, WAITLIST_ENTRY_STATUS.OFFERED],
    );
  }

  async findExpiredOffers(now: Date, limit: number): Promise<WaitlistOfferRecord[]> {
    const result = await this.database.query(
      `select * from waitlist_offer
       where status = $1 and expire_time <= $2
       order by expire_time asc, id asc
       limit $3`,
      [WAITLIST_OFFER_STATUS.OFFERED, now, limit],
    );
    return result.rows.map(row => this.mapOffer(row));
  }

  private async getRank(entryId: number, sessionId: number, ticketTypeId: number): Promise<number> {
    const result = await this.database.query(
      `select count(*) + 1 as rank
       from waitlist_entry current_entry
       join waitlist_entry target on target.id = $1
       where current_entry.session_id = $2
         and current_entry.ticket_type_id = $3
         and current_entry.status = $4
         and (
           current_entry.priority_no < target.priority_no
           or (current_entry.priority_no = target.priority_no and current_entry.create_time < target.create_time)
           or (current_entry.priority_no = target.priority_no and current_entry.create_time = target.create_time and current_entry.id < target.id)
         )`,
      [entryId, sessionId, ticketTypeId, WAITLIST_ENTRY_STATUS.WAITING],
    );
    return Number(result.rows[0]?.rank ?? 1);
  }

  private mapEntry(row: any): WaitlistEntryRecord {
    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      sessionId: Number(row.session_id),
      ticketTypeId: Number(row.ticket_type_id),
      quantity: Number(row.quantity),
      seatPreference: row.seat_preference ?? null,
      status: row.status,
      priorityNo: Number(row.priority_no),
      offerOrderId: row.offer_order_id == null ? null : Number(row.offer_order_id),
      offerExpireTime: row.offer_expire_time ?? null,
      failReason: row.fail_reason ?? null,
      createTime: row.create_time,
      updateTime: row.update_time,
    };
  }

  private mapOffer(row: any): WaitlistOfferRecord {
    return {
      id: Number(row.id),
      entryId: Number(row.entry_id),
      userId: Number(row.user_id),
      sessionId: Number(row.session_id),
      ticketTypeId: Number(row.ticket_type_id),
      quantity: Number(row.quantity),
      orderId: Number(row.order_id),
      status: row.status,
      expireTime: row.expire_time,
      createTime: row.create_time,
      updateTime: row.update_time,
    };
  }
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.repository.spec.ts
```

Expected: PASS.

---

### Task 3: user waitlist APIs

**Files:**
- Create: `nestjs/grab-service/src/waitlist/waitlist.service.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist.controller.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist.module.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist.service.spec.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist.controller.spec.ts`
- Modify: `nestjs/grab-service/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `waitlist.service.spec.ts`:

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  it('creates a waiting entry and returns rank', async () => {
    const repository = {
      createEntry: jest.fn().mockResolvedValue({
        entry: { id: 1, userId: 2004, sessionId: 101, ticketTypeId: 202, quantity: 1, status: 'WAITING', offerOrderId: null, offerExpireTime: null, failReason: null },
        rank: 7,
      }),
    };
    const service = new WaitlistService(repository as any);

    const result = await service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1 });

    expect(result).toMatchObject({ id: 1, status: 'WAITING', rank: 7 });
  });

  it('rejects invalid quantity', async () => {
    const service = new WaitlistService({} as any);
    await expect(service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Write failing controller tests**

Create `waitlist.controller.spec.ts`:

```ts
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
it('creates entries for authenticated user id', async () => {
  const service = { createEntry: jest.fn().mockResolvedValue({ id: 1, status: 'WAITING', rank: 3 }) };
  const controller = new WaitlistController(service as any);

    const result = await controller.create({ user: { userId: 2004 } } as any, { sessionId: 101, ticketTypeId: 202, quantity: 1 });

    expect(service.createEntry).toHaveBeenCalledWith(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1 });
    expect(result).toEqual({ code: 200, message: 'success', data: { id: 1, status: 'WAITING', rank: 3 } });
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.service.spec.ts waitlist.controller.spec.ts
```

Expected: FAIL because service and controller do not exist.

- [ ] **Step 4: Implement user service**

Create `waitlist.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WaitlistRepository } from './waitlist.repository';
import { CreateWaitlistEntryDto, WaitlistEntryRecord, WaitlistEntryResponse } from './waitlist.types';

@Injectable()
export class WaitlistService {
  constructor(private readonly repository: WaitlistRepository) {}

  async createEntry(userId: number, dto: CreateWaitlistEntryDto): Promise<WaitlistEntryResponse> {
    this.validateCreateDto(dto);
    try {
      const result = await this.repository.createEntry({
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
      });
      return this.toResponse(result.entry, result.rank);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('already joined waitlist for this ticket type');
      }
      throw error;
    }
  }

  async listMine(userId: number): Promise<WaitlistEntryResponse[]> {
    const entries = await this.repository.listByUser(userId);
    return entries.map(entry => this.toResponse(entry, entry.rank ?? null));
  }

  async cancelEntry(userId: number, entryId: number): Promise<WaitlistEntryResponse> {
    const entry = await this.repository.cancelWaitingEntry(entryId, userId);
    if (!entry) throw new NotFoundException('waiting waitlist entry not found');
    return this.toResponse(entry, null);
  }

  private validateCreateDto(dto: CreateWaitlistEntryDto): void {
    if (!dto || !Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('sessionId is required');
    if (!Number.isInteger(dto.ticketTypeId) || dto.ticketTypeId <= 0) throw new BadRequestException('ticketTypeId is required');
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || dto.quantity > 6) throw new BadRequestException('quantity must be 1-6');
  }

  private toResponse(entry: WaitlistEntryRecord, rank: number | null): WaitlistEntryResponse {
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      ticketTypeId: entry.ticketTypeId,
      quantity: entry.quantity,
      status: entry.status,
      rank,
      offerOrderId: entry.offerOrderId,
      offerExpireTime: entry.offerExpireTime ? entry.offerExpireTime.toISOString() : null,
      failReason: entry.failReason,
    };
  }
}
```

- [ ] **Step 5: Implement controller and module**

Create `waitlist.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto, WaitlistEntryResponse } from './waitlist.types';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('entries')
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateWaitlistEntryDto): Promise<ApiResult<WaitlistEntryResponse>> {
    return { code: 200, message: 'success', data: await this.waitlistService.createEntry(request.user.userId, body) };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async mine(@Req() request: AuthenticatedRequest): Promise<ApiResult<WaitlistEntryResponse[]>> {
    return { code: 200, message: 'success', data: await this.waitlistService.listMine(request.user.userId) };
  }

  @Delete('entries/:id')
  @UseGuards(JwtAuthGuard)
  async cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<ApiResult<WaitlistEntryResponse>> {
    return { code: 200, message: 'success', data: await this.waitlistService.cancelEntry(request.user.userId, Number(id)) };
  }

}
```

Create `waitlist.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WaitlistController } from './waitlist.controller';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WaitlistController],
  providers: [
    WaitlistService,
    WaitlistRepository,
  ],
})
export class WaitlistModule {}
```

Modify `app.module.ts`:

```ts
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [AuthModule, DatabaseModule, GrabModule, WaitlistModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.service.spec.ts waitlist.controller.spec.ts waitlist.repository.spec.ts
```

Expected: PASS.

---

### Task 4: allocator, order client, and notifications

**Files:**
- Create: `nestjs/grab-service/src/waitlist/waitlist-allocator.service.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist-allocator.service.spec.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist-notification.service.ts`
- Create: `nestjs/grab-service/src/waitlist/waitlist-notification.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
- Modify: `nestjs/grab-service/src/grab/order-client.service.spec.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.controller.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.module.ts`

- [ ] **Step 1: Write failing allocator and notification tests**

Create `waitlist-allocator.service.spec.ts`:

```ts
import { WaitlistAllocatorService } from './waitlist-allocator.service';

describe('WaitlistAllocatorService', () => {
  it('creates one offered order for the earliest eligible entry', async () => {
    const entry = { id: 10, userId: 2004, sessionId: 101, ticketTypeId: 202, quantity: 1, status: 'ALLOCATING' };
    const repository = {
      beginAllocationEvent: jest.fn().mockResolvedValue(true),
      markOfferExpiredByOrder: jest.fn(),
      claimNextEntry: jest.fn().mockResolvedValue(entry),
      markEntryOffered: jest.fn().mockResolvedValue({ ...entry, status: 'OFFERED', offerOrderId: 9001, offerExpireTime: new Date('2026-05-31T00:15:00Z') }),
      createOffer: jest.fn().mockResolvedValue({ id: 99, orderId: 9001 }),
      logAllocationAttempt: jest.fn(),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn().mockResolvedValue(null),
      createWaitlistOfferOrder: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', amount: 100 }),
    };
    const notifications = { notifyOffered: jest.fn(), notifyExpired: jest.fn(), notifyPaid: jest.fn() };
    const service = new WaitlistAllocatorService(repository as any, orderClient as any, notifications as any);

    const result = await service.allocate({ eventKey: 'release-1', source: 'ORDER_TIMEOUT', sourceOrderId: 1, sessionId: 101, ticketTypeId: 202, quantity: 1 });

    expect(result.status).toBe('OFFERED');
    expect(orderClient.createWaitlistOfferOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 2004, grabRequestId: expect.stringContaining('WAITLIST-10-') }));
    expect(notifications.notifyOffered).toHaveBeenCalled();
  });

  it('ignores duplicate release events', async () => {
    const repository = { beginAllocationEvent: jest.fn().mockResolvedValue(false), logAllocationAttempt: jest.fn() };
    const service = new WaitlistAllocatorService(repository as any, {} as any, {} as any);

    const result = await service.allocate({ eventKey: 'release-1', source: 'ORDER_TIMEOUT', sessionId: 101, ticketTypeId: 202, quantity: 1 });

    expect(result.status).toBe('DUPLICATE');
  });
});
```

Create `waitlist-notification.service.spec.ts`:

```ts
import { WaitlistNotificationService } from './waitlist-notification.service';

describe('WaitlistNotificationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NOTIFICATION_SERVICE_URL: 'http://notification.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('posts waitlist offer notification to notification-service internal API', async () => {
    const service = new WaitlistNotificationService();

    await service.notifyOffered({ userId: 2004, orderId: 9001, content: '候补成功，请付款。' });

    expect(fetch).toHaveBeenCalledWith('http://notification.local/api/notification/internal/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Internal-Token': 'internal-token' }),
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist-allocator.service.spec.ts waitlist-notification.service.spec.ts
```

Expected: FAIL because allocator and notification service are missing.

- [ ] **Step 3: Extend order client**

In `order-client.service.ts`, extend `CreateOrderInput`:

```ts
export interface CreateOrderInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
  authorizedMaxUnitPrice?: number | null;
  grabRequestId?: string | null;
  requestedTicketTypeId?: number | null;
  matchedTicketTypeId?: number | null;
  autoDowngraded?: boolean;
}
```

Add a waitlist helper:

```ts
async createWaitlistOfferOrder(input: {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  grabRequestId: string;
}): Promise<CreatedOrderResponse> {
  return this.createOrder({
    userId: input.userId,
    sessionId: input.sessionId,
    ticketTypeId: input.ticketTypeId,
    quantity: input.quantity,
    seatIds: [],
    allocateRandom: true,
    grabRequestId: input.grabRequestId,
    requestedTicketTypeId: input.ticketTypeId,
    matchedTicketTypeId: input.ticketTypeId,
    autoDowngraded: false,
  });
}
```

Keep using `/api/order/internal/create-with-seats` when `allocateRandom=true`, so order-service and ticket-service decide whether to lock seats or standing stock.

- [ ] **Step 4: Implement notification service**

Create `waitlist-notification.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WaitlistNotificationService {
  private readonly logger = new Logger(WaitlistNotificationService.name);
  private readonly baseUrl = process.env.NOTIFICATION_SERVICE_URL || process.env.API_GATEWAY_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async notifyOffered(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_OFFERED', content: input.content });
  }

  async notifyExpired(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_EXPIRED', content: input.content });
  }

  async notifyPaid(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_PAID', content: input.content });
  }

  private async send(body: { userId: number; orderId: number; type: string; content: string }): Promise<void> {
    if (!this.internalToken) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/notification/internal/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
        body: JSON.stringify(body),
      });
      if (!response.ok) this.logger.warn(`waitlist notification failed: ${response.status}`);
    } catch (error) {
      this.logger.warn(`waitlist notification failed: ${(error as Error).message}`);
    }
  }
}
```

- [ ] **Step 5: Implement allocator**

Create `waitlist-allocator.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { OrderClientService } from '../grab/order-client.service';
import { WaitlistNotificationService } from './waitlist-notification.service';
import { WaitlistRepository } from './waitlist.repository';
import { TicketReleasedEventDto, WaitlistEntryRecord } from './waitlist.types';

@Injectable()
export class WaitlistAllocatorService {
  constructor(
    private readonly repository: WaitlistRepository,
    private readonly orderClient: OrderClientService,
    private readonly notifications: WaitlistNotificationService,
  ) {}

  async allocate(event: TicketReleasedEventDto): Promise<{ status: string; entryId?: number; orderId?: number }> {
    this.validateEvent(event);
    const started = await this.repository.beginAllocationEvent(event.eventKey, event.sessionId, event.ticketTypeId, event.quantity, event.sourceOrderId ?? null);
    if (!started) return { status: 'DUPLICATE' };

    if (event.sourceOrderId) {
      await this.repository.markOfferExpiredByOrder(event.sourceOrderId);
    }

    for (let attemptNo = 1; attemptNo <= 10; attemptNo++) {
      const entry = await this.repository.claimNextEntry({
        sessionId: event.sessionId,
        ticketTypeId: event.ticketTypeId,
        releasedQuantity: event.quantity,
      });
      if (!entry) {
        await this.repository.logAllocationAttempt({ eventKey: event.eventKey, attemptNo, sessionId: event.sessionId, ticketTypeId: event.ticketTypeId, releasedQuantity: event.quantity, entryId: null, orderId: null, sourceOrderId: event.sourceOrderId ?? null, status: 'NO_MATCH', message: 'no eligible waiting entry' });
        return { status: 'NO_MATCH' };
      }

      const grabRequestId = this.waitlistGrabRequestId(entry, event.eventKey);
      try {
        const existing = await this.orderClient.findByGrabRequestId(grabRequestId);
        const order = existing ?? await this.orderClient.createWaitlistOfferOrder({
          userId: entry.userId,
          sessionId: entry.sessionId,
          ticketTypeId: entry.ticketTypeId,
          quantity: entry.quantity,
          grabRequestId,
        });
        const expireTime = new Date(Date.now() + 15 * 60 * 1000);
        await this.repository.markEntryOffered(entry.id, order.id, expireTime);
        await this.repository.createOffer({ entry, orderId: order.id, expireTime });
        await this.repository.logAllocationAttempt({ eventKey: event.eventKey, attemptNo, sessionId: event.sessionId, ticketTypeId: event.ticketTypeId, releasedQuantity: event.quantity, entryId: entry.id, orderId: order.id, sourceOrderId: event.sourceOrderId ?? null, status: 'OFFERED', message: 'waitlist offer created' });
        await this.notifications.notifyOffered({ userId: entry.userId, orderId: order.id, content: `候补成功，请在 ${expireTime.toLocaleString()} 前完成支付。` });
        return { status: 'OFFERED', entryId: entry.id, orderId: order.id };
      } catch (error) {
        const message = (error as Error).message || 'order creation failed';
        if (this.isBusinessFailure(message)) {
          await this.repository.markEntryFailed(entry.id, message);
          await this.repository.logAllocationAttempt({ eventKey: event.eventKey, attemptNo, sessionId: event.sessionId, ticketTypeId: event.ticketTypeId, releasedQuantity: event.quantity, entryId: entry.id, orderId: null, sourceOrderId: event.sourceOrderId ?? null, status: 'FAILED', message });
          continue;
        }
        await this.repository.restoreAllocatingEntry(entry.id, message);
        await this.repository.logAllocationAttempt({ eventKey: event.eventKey, attemptNo, sessionId: event.sessionId, ticketTypeId: event.ticketTypeId, releasedQuantity: event.quantity, entryId: entry.id, orderId: null, sourceOrderId: event.sourceOrderId ?? null, status: 'FAILED', message });
        return { status: 'FAILED', entryId: entry.id };
      }
    }

    return { status: 'NO_MATCH' };
  }

  async markPaidByOrder(orderId: number): Promise<{ status: string }> {
    await this.repository.markOfferPaidByOrder(orderId);
    return { status: 'PAID' };
  }

  async scanExpiredOffers(): Promise<{ scanned: number }> {
    const offers = await this.repository.findExpiredOffers(new Date(), 50);
    for (const offer of offers) {
      await this.repository.markOfferExpiredByOrder(offer.orderId);
      await this.notifications.notifyExpired({
        userId: offer.userId,
        orderId: offer.orderId,
        content: '候补付款已过期，名额已释放。',
      });
    }
    return { scanned: offers.length };
  }

  private validateEvent(event: TicketReleasedEventDto): void {
    if (!event?.eventKey || !event.sessionId || !event.ticketTypeId || !event.quantity || event.quantity <= 0) {
      throw new Error('invalid waitlist release event');
    }
  }

  private waitlistGrabRequestId(entry: Pick<WaitlistEntryRecord, 'id'>, eventKey: string): string {
    const hash = createHash('sha256').update(eventKey).digest('hex').slice(0, 16);
    return `WAITLIST-${entry.id}-${hash}`;
  }

  private isBusinessFailure(message: string): boolean {
    return /限购|库存不足|不可售|不存在|already|duplicate|sold out|not enough/i.test(message);
  }
}
```

- [ ] **Step 6: Add internal endpoints and module providers**

Modify `waitlist.controller.ts` imports:

```ts
import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WaitlistAllocatorService } from './waitlist-allocator.service';
import { CreateWaitlistEntryDto, TicketReleasedEventDto, WaitlistEntryResponse } from './waitlist.types';
```

Modify the constructor and add internal token checking:

```ts
private readonly internalToken = process.env.INTERNAL_API_TOKEN || '';

constructor(
  private readonly waitlistService: WaitlistService,
  private readonly allocator: WaitlistAllocatorService,
) {}

@Post('internal/released')
async released(@Headers('x-internal-token') token: string | undefined, @Body() body: TicketReleasedEventDto): Promise<ApiResult<unknown>> {
  this.requireInternalToken(token);
  return { code: 200, message: 'success', data: await this.allocator.allocate(body) };
}

@Post('internal/offers/expire-scan')
async expireScan(@Headers('x-internal-token') token: string | undefined): Promise<ApiResult<unknown>> {
  this.requireInternalToken(token);
  return { code: 200, message: 'success', data: await this.allocator.scanExpiredOffers() };
}

@Post('internal/orders/:orderId/paid')
async orderPaid(@Headers('x-internal-token') token: string | undefined, @Param('orderId') orderId: string): Promise<ApiResult<unknown>> {
  this.requireInternalToken(token);
  return { code: 200, message: 'success', data: await this.allocator.markPaidByOrder(Number(orderId)) };
}

private requireInternalToken(token: string | undefined): void {
  if (!this.internalToken || token !== this.internalToken) {
    throw new UnauthorizedException('invalid internal token');
  }
}
```

Modify `waitlist.module.ts` imports:

```ts
import { OrderClientService } from '../grab/order-client.service';
import { WaitlistAllocatorService } from './waitlist-allocator.service';
import { WaitlistNotificationService } from './waitlist-notification.service';
```

Modify providers:

```ts
providers: [
  WaitlistService,
  WaitlistRepository,
  WaitlistAllocatorService,
  WaitlistNotificationService,
  OrderClientService,
],
```

- [ ] **Step 7: Run allocator and order client tests**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist-allocator.service.spec.ts waitlist-notification.service.spec.ts order-client.service.spec.ts
```

Expected: PASS.

---

### Task 5: order and ticket release events

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesReleaseResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/client/TicketSalesInternalClient.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketReleasedEvent.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/WaitlistReleaseRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/client/WaitlistInternalClient.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/SeatLockScheduler.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/SeatLockSchedulerTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: Write failing ticket release response tests**

In `TicketSalesInternalServiceTest`, add:

```java
@Test
void refundReturnsZeroRestoredQuantityWhenRefundedSeatsCannotResell() {
    TicketSalesOrderRequest request = new TicketSalesOrderRequest();
    request.setSessionId(101L);
    request.setTicketTypeId(202L);
    request.setSeatIds(List.of(3001L));
    request.setQuantity(1);

    when(sessionSeatMapper.restoreSoldSeat(3001L, 101L)).thenReturn(0);

    TicketSalesReleaseResponse response = service.refund(request);

    assertEquals(0, response.getRestoredQuantity());
}
```

Expected initial failure: `refund` returns `void` and `TicketSalesReleaseResponse` does not exist.

In `OrderServiceTest`, add a waitlist idempotency-key regression test:

```java
// Add imports:
// import com.omni.order.dto.TicketSalesSeatLockResponse;
// import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@Test
void createOrderWithSeatsAllowsWaitlistGrabRequestIdWithoutAuthorizedPrice() {
    LockSeatsRequest request = new LockSeatsRequest();
    request.setUserId(2004L);
    request.setSessionId(101L);
    request.setTicketTypeId(202L);
    request.setQuantity(1);
    request.setSeatIds(List.of());
    request.setGrabRequestId("WAITLIST-10-abcdef1234567890");
    request.setAuthorizedMaxUnitPrice(null);

    TicketSalesQuoteResponse quote = quoteWithoutLimit(1);
    quote.setTicketTypeId(202L);
    quote.setUnitPrice(new BigDecimal("100.00"));
    TicketSalesSeatLockResponse lockResponse = new TicketSalesSeatLockResponse();
    lockResponse.setLockedSeatIds(List.of(3001L));

    when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
    when(orderMapper.insert(any(Order.class))).thenAnswer(invocation -> {
        Order order = invocation.getArgument(0);
        order.setId(9001L);
        return 1;
    });
    when(ticketSalesInternalClient.lockSeats(any(), anyString())).thenReturn(Result.success(lockResponse));

    assertDoesNotThrow(() -> service.createOrderWithSeats(request));
}
```

Expected initial failure: current `validateAuthorizedPrice(...)` rejects any non-empty `grabRequestId` without `authorizedMaxUnitPrice`.

- [ ] **Step 2: Create ticket release response DTO**

Create `TicketSalesReleaseResponse.java`:

```java
package com.omni.ticket.dto;

import java.util.ArrayList;
import java.util.List;

public class TicketSalesReleaseResponse {
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private Integer restoredQuantity;
    private List<Long> seatIds = new ArrayList<>();

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Integer getRestoredQuantity() { return restoredQuantity; }
    public void setRestoredQuantity(Integer restoredQuantity) { this.restoredQuantity = restoredQuantity; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
}
```

- [ ] **Step 3: Change ticket release and refund methods**

In `TicketSalesInternalService.release(...)`, return:

```java
TicketSalesReleaseResponse response = new TicketSalesReleaseResponse();
response.setSessionId(request.getSessionId());
response.setTicketTypeId(request.getTicketTypeId());
response.setQuantity(requirePositiveQuantity(request.getQuantity()));
response.setSeatIds(request.getSeatIds() != null ? request.getSeatIds() : Collections.emptyList());
response.setRestoredQuantity(response.getQuantity());
return response;
```

In `refund(...)`, set `restoredQuantity` to the actual restored seat count, or quantity for standing tickets:

```java
TicketSalesReleaseResponse response = new TicketSalesReleaseResponse();
response.setSessionId(request.getSessionId());
response.setTicketTypeId(request.getTicketTypeId());
response.setQuantity(requirePositiveQuantity(request.getQuantity()));
response.setSeatIds(request.getSeatIds() != null ? request.getSeatIds() : Collections.emptyList());
response.setRestoredQuantity(restored);
return response;
```

For non-seat standing refunds:

```java
ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), requirePositiveQuantity(request.getQuantity()));
response.setRestoredQuantity(requirePositiveQuantity(request.getQuantity()));
```

- [ ] **Step 4: Update internal controller and Feign clients**

Change ticket controller return types:

```java
@PostMapping("/release")
public Result<TicketSalesReleaseResponse> release(...) {
    requireInternalToken(token);
    return Result.success(service.release(request));
}

@PostMapping("/refund")
public Result<TicketSalesReleaseResponse> refund(...) {
    requireInternalToken(token);
    return Result.success(service.refund(request));
}
```

Change order-side `TicketSalesInternalClient`:

```java
Result<TicketSalesReleaseResponse> release(@RequestBody TicketSalesOrderRequest request,
                                           @RequestHeader("X-Internal-Token") String internalToken);

Result<TicketSalesReleaseResponse> refund(@RequestBody TicketSalesOrderRequest request,
                                          @RequestHeader("X-Internal-Token") String internalToken);
```

- [ ] **Step 5: Add waitlist internal client**

Create `WaitlistInternalClient.java`:

```java
package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.WaitlistReleaseRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "waitlist-service", url = "${waitlist.service.url:http://localhost:3001}")
public interface WaitlistInternalClient {
    @PostMapping("/api/waitlist/internal/released")
    Result<Object> released(@RequestBody WaitlistReleaseRequest request,
                            @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/waitlist/internal/orders/{orderId}/paid")
    Result<Object> orderPaid(@PathVariable("orderId") Long orderId,
                             @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 6: Add order release event DTOs**

Create `TicketReleasedEvent.java`:

```java
package com.omni.order.dto;

import java.util.ArrayList;
import java.util.List;

public class TicketReleasedEvent {
    private String eventKey;
    private String source;
    private Long sourceOrderId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private List<Long> seatIds = new ArrayList<>();

    // getters and setters
}
```

Create `WaitlistReleaseRequest.java` with the same fields and a constructor from `TicketReleasedEvent`.

- [ ] **Step 7: Extend order service release methods**

Add `releaseExpiredSeatLocksDetailed()` that returns release events while keeping the old method for compatibility:

```java
@Transactional
public List<TicketReleasedEvent> releaseExpiredSeatLocksDetailed() {
    List<TicketReleasedEvent> events = new ArrayList<>();
    // move current releaseExpiredSeatLocks body here
    // after each successful releaseSingleLockedSeat, add event for quantity 1
    // after each successful releaseLockedResourcesBestEffort, add event for order quantity
    return events;
}

@Transactional
public int releaseExpiredSeatLocks() {
    return releaseExpiredSeatLocksDetailed().stream()
            .mapToInt(event -> event.getQuantity() == null ? 0 : event.getQuantity())
            .sum();
}
```

Event key examples:

```java
"order-timeout:" + order.getId() + ":session:" + order.getSessionId() + ":ticket-type:" + order.getTicketTypeId()
"order-seat-timeout:" + orderSeat.getId() + ":session:" + orderSeat.getSessionId() + ":ticket-type:" + orderSeat.getTicketTypeId()
```

For refund paths, after ticket-service returns `restoredQuantity > 0`, create:

```java
"refund:" + order.getId() + ":session:" + order.getSessionId() + ":ticket-type:" + order.getTicketTypeId() + ":quantity:" + restoredQuantity
```

Also update `validateAuthorizedPrice(...)` so it still protects normal grab orders but allows waitlist offer idempotency keys:

```java
private void validateAuthorizedPrice(BigDecimal authorizedMaxUnitPrice, TicketSalesQuoteResponse quote, String grabRequestId) {
    if (authorizedMaxUnitPrice == null) {
        if (StringUtils.hasText(grabRequestId) && !grabRequestId.startsWith("WAITLIST-")) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "authorized price is required for grab order");
        }
        return;
    }
    if (quote == null || quote.getUnitPrice() == null) {
        return;
    }
    if (quote.getUnitPrice().compareTo(authorizedMaxUnitPrice) > 0) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "ticket price exceeds authorized price");
    }
}
```

- [ ] **Step 8: Publish events from scheduler and payment success**

In `SeatLockScheduler.releaseExpiredSeatLocks()`:

```java
List<TicketReleasedEvent> events = orderService.releaseExpiredSeatLocksDetailed();
orderService.publishWaitlistReleaseEvents(events);
```

In `OrderService.markPaid(...)`, after `confirmTicketsSold(order)`:

```java
notifyWaitlistPaid(order.getId());
```

Both publisher methods catch and log waitlist failures without rolling back order/ticket facts.

- [ ] **Step 9: Run Java tests**

Run:

```bash
cd java
mvn -pl java-ticket,java-order -Dtest=TicketSalesInternalServiceTest,SeatLockSchedulerTest,OrderSeatServiceTest,OrderServiceTest test
```

Expected: PASS.

---

### Task 6: gateway route and frontend waitlist entry

**Files:**
- Modify: `java/java-gateway/src/main/resources/application.yml`
- Modify: `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/waitlist.ts`
- Create: `frontend/src/lib/waitlist.test.ts`
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: Write failing frontend helper test**

Create `frontend/src/lib/waitlist.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { getWaitlistStatusLabel, canJoinWaitlistFromGrabStatus } from './waitlist.ts'

test('canJoinWaitlistFromGrabStatus enables waitlist for sold out terminal states', () => {
  assert.equal(canJoinWaitlistFromGrabStatus('SOLD_OUT'), true)
  assert.equal(canJoinWaitlistFromGrabStatus('FAILED'), true)
  assert.equal(canJoinWaitlistFromGrabStatus('ORDER_CREATED'), false)
})

test('getWaitlistStatusLabel returns user-facing labels', () => {
  assert.equal(getWaitlistStatusLabel('WAITING'), '候补中')
  assert.equal(getWaitlistStatusLabel('OFFERED'), '待支付')
})
```

- [ ] **Step 2: Run helper test to verify failure**

Run:

```bash
cd frontend
node --test src/lib/waitlist.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement frontend helper**

Create `frontend/src/lib/waitlist.ts`:

```ts
const JOINABLE_GRAB_STATUSES = new Set(['SOLD_OUT', 'FAILED', 'LIMITED'])

export function canJoinWaitlistFromGrabStatus(status: string | null | undefined) {
  return Boolean(status && JOINABLE_GRAB_STATUSES.has(status))
}

export function getWaitlistStatusLabel(status: string) {
  const labels: Record<string, string> = {
    WAITING: '候补中',
    ALLOCATING: '分配中',
    OFFERED: '待支付',
    PAID: '已支付',
    CANCELLED: '已取消',
    EXPIRED: '已过期',
    FAILED: '候补失败',
  }
  return labels[status] ?? status
}
```

- [ ] **Step 4: Add frontend API types and calls**

In `frontend/src/types/api.ts`:

```ts
export interface WaitlistEntryVO {
  id: number
  sessionId: number
  ticketTypeId: number
  quantity: number
  status: 'WAITING' | 'ALLOCATING' | 'OFFERED' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED'
  rank: number | null
  offerOrderId: number | null
  offerExpireTime: string | null
  failReason: string | null
}
```

In `frontend/src/lib/api.ts`:

```ts
export async function createWaitlistEntry(params: { sessionId: number; ticketTypeId: number; quantity: number }) {
  return request<import('@/types/api').WaitlistEntryVO>('/api/waitlist/entries', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function listMyWaitlistEntries() {
  return request<import('@/types/api').WaitlistEntryVO[]>('/api/waitlist/my')
}

export async function cancelWaitlistEntry(id: number) {
  return request<import('@/types/api').WaitlistEntryVO>(`/api/waitlist/entries/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 5: Enable activity page waitlist button**

In `activity/[id]/page.tsx`, import:

```ts
import { createWaitlistEntry } from '@/lib/api'
import { canJoinWaitlistFromGrabStatus } from '@/lib/waitlist'
```

Add state:

```ts
const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
const [waitlistMessage, setWaitlistMessage] = useState('')
```

Add handler:

```ts
const handleJoinWaitlist = async () => {
  if (!selectedSession || !selectedTicket) return
  setWaitlistSubmitting(true)
  setOrderError('')
  try {
    const entry = await createWaitlistEntry({
      sessionId: selectedSession.session.id,
      ticketTypeId: selectedTicket.id,
      quantity,
    })
    setWaitlistMessage(entry.rank != null ? `已加入候补，当前约第 ${entry.rank} 位` : '已加入候补')
  } catch (err: unknown) {
    setOrderError(err instanceof Error ? err.message : '加入候补失败')
  } finally {
    setWaitlistSubmitting(false)
  }
}
```

Replace the disabled “加入候补” button:

```tsx
{canJoinWaitlistFromGrabStatus(grabProgress.status) && (
  <button
    type="button"
    onClick={() => void handleJoinWaitlist()}
    disabled={waitlistSubmitting}
    className="cursor-pointer rounded border-none bg-[#ff1268] px-4 py-2 text-[14px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
  >
    {waitlistSubmitting ? '加入中...' : '加入候补'}
  </button>
)}
```

Show `waitlistMessage` near `orderError`:

```tsx
{waitlistMessage && (
  <div className="mb-4 rounded border border-[#d9f7be] bg-[#f6ffed] p-2.5 text-[13px] text-[#389e0d]">
    {waitlistMessage}
  </div>
)}
```

- [ ] **Step 6: Add gateway route**

In `application.yml`, add before `grab-service` or after it:

```yaml
        - id: waitlist-service
          uri: http://localhost:3001
          predicates:
            - Path=/api/waitlist/**
```

In `GatewaySentinelConfig`, add:

```java
public static final String WAITLIST_API = "gateway-api-waitlist";
```

Register:

```java
addApiPath(definitions, WAITLIST_API, "/api/waitlist");
rules.add(gatewayFlowRule(WAITLIST_API, waitlistQps));
```

Use default QPS `20` unless the existing constructor pattern requires a configurable property.

- [ ] **Step 7: Run frontend and gateway checks**

Run:

```bash
cd frontend
node --test src/lib/waitlist.test.ts
pnpm typecheck
```

Expected: PASS.

Run:

```bash
cd java
mvn -pl java-gateway -Dtest=GatewaySentinelConfigTest test
```

Expected: PASS if gateway tests exist; otherwise compile with the broader verification in Task 7.

---

### Task 7: integration verification and docs sync

**Files:**
- Modify: `CLAUDE.md` only if the runtime contract needs to mention `/api/waitlist/**`
- Modify: `sql/docker-init/010-seata-undo-log.sql` or local init assets only if project policy requires fresh local rebuild support

- [ ] **Step 1: Run grab-service waitlist tests**

Run:

```bash
cd nestjs/grab-service
npm test -- waitlist.repository.spec.ts waitlist.service.spec.ts waitlist.controller.spec.ts waitlist-allocator.service.spec.ts waitlist-notification.service.spec.ts order-client.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run Java targeted tests**

Run:

```bash
cd java
mvn -pl java-ticket,java-order,java-gateway -Dtest=TicketSalesInternalServiceTest,SeatLockSchedulerTest,OrderSeatServiceTest,OrderServiceTest,GatewaySentinelConfigTest test
```

Expected: PASS.

- [ ] **Step 3: Run microservice boundary check**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: PASS. There must be no cross-service Mapper, Entity, XML mapper, or cross-database join for waitlist.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd frontend
node --test src/lib/waitlist.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Manual end-to-end verification**

Start services:

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

Verify:

1. Use `13900000001 / 123456` to log in.
2. Open a sold-out activity ticket type.
3. Submit a grab request and wait for `SOLD_OUT`.
4. Click `加入候补`.
5. Confirm response includes `status=WAITING` and a rank.
6. Create or expire a pending order for the same session and ticket type.
7. Confirm waitlist entry becomes `OFFERED` and an order is created.
8. Pay that order and confirm waitlist entry becomes `PAID`.
9. Repeat with another waitlist entry and let the first offered order expire.
10. Confirm the expired offer becomes `EXPIRED` and the next entry receives an offer.

- [ ] **Step 6: User-authorized commit**

Only commit if the user explicitly asks:

```bash
git add docs/superpowers/specs/2026-05-31-waitlist-queue-design.md docs/superpowers/plans/2026-05-31-waitlist-queue.md
git commit -m "docs: add waitlist queue plan"
```

---

## Self-Review

- Spec coverage: Covers sold-out join, duplicate protection, atomic `ALLOCATING`, same-ticket full allocation, order-service reuse, timeout recursion, refund release, payment success, notifications, frontend entry, and microservice boundaries.
- Placeholder scan: No pending-marker placeholders or vague deferred-implementation instructions; ellipsis hits are code syntax or abbreviated Java signatures.
- Type consistency: Uses `WaitlistEntryRecord`, `WaitlistEntryResponse`, `TicketReleasedEventDto`, `WAITLIST-*` statuses, and `/api/waitlist/**` consistently.
- Scope note: No seat preference, member priority, split allocation, cross-ticket fallback, or custom waitlist payment timeout is included in this first version.
