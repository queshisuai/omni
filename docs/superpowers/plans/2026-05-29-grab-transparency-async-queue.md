# Grab Transparency Async Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real asynchronous grab queue transparency layer with stable progress polling, visible stock snapshots, same-session ticket downgrade authorization, and order snapshots that show the matched ticket type.

**Architecture:** `POST /api/grab/requests` becomes enqueue-only and returns a stable request id plus queue position. A new in-process `GrabWorkerService` consumes Redis FIFO queues and advances `grab_request` progress state while using the existing Redis Lua admission and order internal API for correctness. The frontend polls `GET /api/grab/requests/{requestId}/progress` every second and stops on terminal states.

**Tech Stack:** NestJS 10, Jest, Redis/ioredis, PostgreSQL, Spring Boot 2.7, MyBatis-Plus, JUnit/Mockito, Next.js 16, React 19, TypeScript.

---

## Scope Check

This is one integrated feature, not separate independent subsystems. The backend queue, progress API, order authorization, visible stock, and frontend progress UI must land together to satisfy the acceptance criteria. The implementation is still split into independently testable tasks with commits after each task.

## File Structure And Responsibilities

### grab-service

- Modify: `sql/production-split/grab/001_create_grab_request.sql`
  Extends `grab_request` for queue/progress/downgrade state.
- Modify: `nestjs/grab-service/src/grab/grab-status.ts`
  Defines progress statuses and terminal-state helpers.
- Modify: `nestjs/grab-service/src/grab/grab.types.ts`
  Defines submit payloads, preferences, progress responses, attempts, and repository inputs.
- Modify: `nestjs/grab-service/src/grab/redis.service.ts`
  Adds Redis list, set, hash, and max-processed helpers needed by the queue.
- Create: `nestjs/grab-service/src/grab/grab-queue.service.ts`
  Encapsulates queue sequence allocation, FIFO enqueue/dequeue, active sessions, and queue rank.
- Create: `nestjs/grab-service/src/grab/grab-queue.service.spec.ts`
  Tests queue key usage and processed-sequence monotonicity.
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
  Persists async request state, progress updates, worker claims, attempts snapshots, and matched ticket type.
- Modify: `nestjs/grab-service/src/grab/grab.repository.spec.ts`
  Tests SQL parameters and mapping for new fields.
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
  Converts submit to enqueue-only, exposes progress, cancellation, and worker processing helpers.
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`
  Replaces old synchronous submit expectations with enqueue/progress behavior.
- Modify: `nestjs/grab-service/src/grab/grab.controller.ts`
  Adds `GET /progress` and `GET /api/grab/sessions/{sessionId}/stock-visible`.
- Modify: `nestjs/grab-service/src/grab/grab.controller.spec.ts`
  Tests authenticated user id usage and progress routing.
- Create: `nestjs/grab-service/src/grab/grab-worker.service.ts`
  Consumes Redis queue and runs ticket attempts.
- Create: `nestjs/grab-service/src/grab/grab-worker.service.spec.ts`
  Tests single ticket success, authorized downgrade, no-downgrade sold out, and release-on-failure.
- Create: `nestjs/grab-service/src/grab/ticket-client.service.ts`
  Calls ticket internal APIs for ticket type validation/metadata visible to grab-service.
- Create: `nestjs/grab-service/src/grab/ticket-client.service.spec.ts`
  Tests internal token, request paths, and response mapping.
- Create: `nestjs/grab-service/src/grab/visible-stock.service.ts`
  Builds stock snapshots from Redis first, then ticket metadata fallback.
- Create: `nestjs/grab-service/src/grab/visible-stock.service.spec.ts`
  Tests `AVAILABLE`, `LOW`, `HOT`, `SOLD_OUT`, and `UNKNOWN`.
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
  Sends `authorizedMaxUnitPrice`, `grabRequestId`, and ticket match metadata.
- Modify: `nestjs/grab-service/src/grab/order-client.service.spec.ts`
  Tests new body fields.
- Modify: `nestjs/grab-service/src/grab/grab.module.ts`
  Registers the queue, worker, ticket client, and stock services.

### java-ticket

- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypeVisibleResponse.java`
  Internal response for ticket type metadata and DB remain-stock snapshot.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypesVisibleRequest.java`
  Internal request containing `sessionId` and ticket type ids.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
  Adds `POST /api/ticket/internal/sales/ticket-types-visible`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
  Validates ticket types are active and belong to the requested session.
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java`
  Tests internal token and visible metadata endpoint.

### java-order

- Modify: `sql/production-split/order/001_same_owner_constraints.sql` or create `sql/production-split/order/20260529_grab_order_snapshot.sql`
  Adds grab snapshot columns to `order_snapshot`.
- Modify: `java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java`
  Adds `authorizedMaxUnitPrice`, `grabRequestId`, `requestedTicketTypeId`, `matchedTicketTypeId`, `autoDowngraded`.
- Modify: `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java`
  Adds the same authorization/snapshot fields for seat/random allocation orders.
- Modify: `java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java`
  Adds grab snapshot fields.
- Modify: `java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java`
  Returns grab snapshot fields for order display.
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`
  Selects grab snapshot fields into order list/detail.
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
  Checks quote unit price against authorized max and writes grab snapshot metadata.
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`
  Tests price authorization rejection and snapshot writing.
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderListServiceTest.java`
  Tests actual matched ticket fields flow into order list item.

### frontend

- Modify: `frontend/src/types/api.ts`
  Adds async grab statuses, submit preferences, progress response, and visible stock types.
- Modify: `frontend/src/lib/api.ts`
  Adds `getGrabProgress`, `getGrabVisibleStock`, and expanded submit payload.
- Modify: `frontend/src/app/activity/[id]/page.tsx`
  Adds downgrade authorization, progress modal, stock hints, polling, and terminal actions.
- Modify: `frontend/src/app/orders/page.tsx`
  Displays actual matched ticket/downgrade marker when present.

---

### Task 1: Extend Grab Request Schema And Types

**Files:**
- Modify: `sql/production-split/grab/001_create_grab_request.sql`
- Modify: `nestjs/grab-service/src/grab/grab-status.ts`
- Modify: `nestjs/grab-service/src/grab/grab.types.ts`
- Modify: `nestjs/grab-service/src/grab/grab-status.spec.ts`

- [ ] **Step 1: Write failing status tests**

In `nestjs/grab-service/src/grab/grab-status.spec.ts`, replace the current status test with:

```ts
import { GRAB_STATUS, isTerminalGrabStatus, isQueueProgressStatus } from './grab-status';

describe('grab status', () => {
  it('marks only final progress states as terminal', () => {
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.SOLD_OUT)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.LIMITED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.FAILED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.EXPIRED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.QUEUED)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.WAITING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.TRYING_TICKET_TYPE)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.LOCKING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.DOWNGRADING)).toBe(false);
  });

  it('recognizes queue progress statuses used by the transparency layer', () => {
    expect(isQueueProgressStatus(GRAB_STATUS.QUEUED)).toBe(true);
    expect(isQueueProgressStatus(GRAB_STATUS.WAITING)).toBe(true);
    expect(isQueueProgressStatus(GRAB_STATUS.ORDER_CREATED)).toBe(true);
    expect(isQueueProgressStatus('PENDING' as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run status tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-status.spec.ts
```

Expected: FAIL because `QUEUED`, `WAITING`, `TRYING_TICKET_TYPE`, `LOCKING`, `DOWNGRADING`, and `isQueueProgressStatus` do not exist yet.

- [ ] **Step 3: Implement statuses and types**

Update `nestjs/grab-service/src/grab/grab-status.ts` to:

```ts
export const GRAB_STATUS = {
  QUEUED: 'QUEUED',
  WAITING: 'WAITING',
  TRYING_TICKET_TYPE: 'TRYING_TICKET_TYPE',
  LOCKING: 'LOCKING',
  ORDER_CREATING: 'ORDER_CREATING',
  ORDER_CREATED: 'ORDER_CREATED',
  SOLD_OUT: 'SOLD_OUT',
  DOWNGRADING: 'DOWNGRADING',
  FAILED: 'FAILED',
  LIMITED: 'LIMITED',
  EXPIRED: 'EXPIRED',
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
} as const;

export type GrabStatus = (typeof GRAB_STATUS)[keyof typeof GRAB_STATUS];

const TERMINAL_STATUSES = new Set<GrabStatus>([
  GRAB_STATUS.ORDER_CREATED,
  GRAB_STATUS.SOLD_OUT,
  GRAB_STATUS.LIMITED,
  GRAB_STATUS.FAILED,
  GRAB_STATUS.EXPIRED,
]);

const QUEUE_PROGRESS_STATUSES = new Set<GrabStatus>([
  GRAB_STATUS.QUEUED,
  GRAB_STATUS.WAITING,
  GRAB_STATUS.TRYING_TICKET_TYPE,
  GRAB_STATUS.LOCKING,
  GRAB_STATUS.ORDER_CREATING,
  GRAB_STATUS.ORDER_CREATED,
  GRAB_STATUS.SOLD_OUT,
  GRAB_STATUS.DOWNGRADING,
  GRAB_STATUS.FAILED,
  GRAB_STATUS.LIMITED,
  GRAB_STATUS.EXPIRED,
]);

export function isTerminalGrabStatus(status: GrabStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isQueueProgressStatus(status: GrabStatus): boolean {
  return QUEUE_PROGRESS_STATUSES.has(status);
}
```

Update `nestjs/grab-service/src/grab/grab.types.ts` with these interfaces:

```ts
import type { GrabStatus } from './grab-status';

export interface TicketTypePreferenceDto {
  ticketTypeId: number;
  name?: string;
  maxPrice?: number;
}

export interface SubmitGrabRequestDto {
  sessionId: number;
  ticketTypeId?: number;
  quantity: number;
  seatIds?: number[];
  allocateRandom?: boolean;
  idempotencyKey: string;
  ticketTypePreferences?: TicketTypePreferenceDto[];
  allowAutoDowngrade?: boolean;
}

export interface GrabTicketPreference {
  ticketTypeId: number;
  name: string | null;
  maxPrice: number | null;
}

export interface GrabAttemptSnapshot {
  ticketTypeId: number;
  name: string | null;
  status: 'PENDING' | 'TRYING' | 'LOCKING' | 'SOLD_OUT' | 'LIMITED' | 'FAILED' | 'ORDER_CREATED';
  message: string;
}

export interface VisibleStockSnapshot {
  ticketTypeId: number;
  visibleStock: number | null;
  level: 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN';
  snapshotTime: string;
}

export interface GrabRequestRecord {
  id: number;
  requestId: string;
  idempotencyKey: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
  status: GrabStatus;
  progressStatus: GrabStatus;
  progressMessage: string | null;
  orderId: number | null;
  failReason: string | null;
  requestType: 'NORMAL_GRAB' | 'TEAM_GRAB' | 'WAITLIST_OFFER';
  queueSeq: number | null;
  requestedTicketTypes: GrabTicketPreference[];
  allowAutoDowngrade: boolean;
  currentTicketTypeId: number | null;
  currentAttemptIndex: number;
  matchedTicketTypeId: number | null;
  attemptsSnapshot: GrabAttemptSnapshot[];
  workerId: string | null;
  workerClaimedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  expireTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

Keep the existing `CreatePendingGrabRequestInput`, `FindActiveGrabIntentInput`, and `GrabRequestResponse` but expand them:

```ts
export interface CreateQueuedGrabRequestInput {
  requestId: string;
  idempotencyKey: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
  expireTime: Date;
  queueSeq: number;
  requestedTicketTypes: GrabTicketPreference[];
  allowAutoDowngrade: boolean;
}

export interface FindActiveGrabIntentInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
}

export interface GrabRequestResponse {
  requestId: string;
  status: GrabStatus;
  orderId: number | null;
  failReason: string | null;
  queueSeq?: number | null;
  queueRank?: number | null;
  estimatedWaitSeconds?: number | null;
  message?: string | null;
}

export interface GrabProgressResponse extends GrabRequestResponse {
  sessionId: number;
  currentTicketTypeId: number | null;
  currentAttemptIndex: number;
  requestedTicketTypes: GrabTicketPreference[];
  attempts: GrabAttemptSnapshot[];
  visibleStock: VisibleStockSnapshot | null;
  matchedTicketTypeId: number | null;
  updateTime: string;
}
```

- [ ] **Step 4: Extend grab_request schema**

Update `sql/production-split/grab/001_create_grab_request.sql` so new installs create the async columns:

```sql
    request_type varchar(32) not null default 'NORMAL_GRAB',
    queue_seq bigint,
    requested_ticket_types jsonb not null default '[]'::jsonb,
    allow_auto_downgrade boolean not null default false,
    current_ticket_type_id bigint,
    current_attempt_index integer not null default 0,
    matched_ticket_type_id bigint,
    progress_status varchar(32) not null default 'QUEUED',
    progress_message varchar(512),
    attempts_snapshot jsonb not null default '[]'::jsonb,
    worker_claimed_at timestamptz,
    worker_id varchar(128),
    processing_started_at timestamptz,
    completed_at timestamptz,
```

Expand the status check to include the new values:

```sql
        'QUEUED',
        'WAITING',
        'TRYING_TICKET_TYPE',
        'LOCKING',
        'ORDER_CREATING',
        'ORDER_CREATED',
        'SOLD_OUT',
        'DOWNGRADING',
        'FAILED',
        'LIMITED',
        'EXPIRED',
        'PENDING',
        'ACCEPTED'
```

Add indexes:

```sql
create index if not exists idx_grab_request_session_queue_seq
    on grab_request (session_id, queue_seq);

create index if not exists idx_grab_request_progress_expire_time
    on grab_request (progress_status, expire_time);
```

- [ ] **Step 5: Run status tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-status.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add sql/production-split/grab/001_create_grab_request.sql nestjs/grab-service/src/grab/grab-status.ts nestjs/grab-service/src/grab/grab-status.spec.ts nestjs/grab-service/src/grab/grab.types.ts
git commit -m "feat: extend grab progress schema and types"
```

---

### Task 2: Add Redis Queue Service

**Files:**
- Modify: `nestjs/grab-service/src/grab/redis.service.ts`
- Create: `nestjs/grab-service/src/grab/grab-queue.service.ts`
- Create: `nestjs/grab-service/src/grab/grab-queue.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.module.ts`

- [ ] **Step 1: Write failing queue service tests**

Create `nestjs/grab-service/src/grab/grab-queue.service.spec.ts`:

```ts
import { GrabQueueService } from './grab-queue.service';

describe('GrabQueueService', () => {
  it('assigns a queue sequence and enqueues request FIFO by session', async () => {
    const redis: any = {
      incr: jest.fn().mockResolvedValue(12),
      rpush: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('7'),
    };
    const service = new GrabQueueService(redis);

    const result = await service.enqueue({
      requestId: 'GRAB1',
      sessionId: 101,
      userId: 2004,
    });

    expect(redis.incr).toHaveBeenCalledWith('grab:queue:seq:101');
    expect(redis.rpush).toHaveBeenCalledWith('grab:queue:101', 'GRAB1');
    expect(redis.sadd).toHaveBeenCalledWith('grab:active-sessions', '101');
    expect(redis.hset).toHaveBeenCalledWith('grab:req:GRAB1', {
      requestId: 'GRAB1',
      sessionId: '101',
      userId: '2004',
      queueSeq: '12',
      status: 'QUEUED',
    });
    expect(result).toEqual({ queueSeq: 12, queueRank: 4 });
  });

  it('does not move processed sequence backwards', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('20'),
      set: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await service.markProcessed(101, 18);

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('dequeues from the session FIFO queue', async () => {
    const redis: any = {
      lpop: jest.fn().mockResolvedValue('GRAB1'),
    };
    const service = new GrabQueueService(redis);

    await expect(service.dequeue(101)).resolves.toBe('GRAB1');
    expect(redis.lpop).toHaveBeenCalledWith('grab:queue:101');
  });
});
```

- [ ] **Step 2: Run queue tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-queue.service.spec.ts
```

Expected: FAIL because `GrabQueueService` and Redis list/set/hash methods do not exist.

- [ ] **Step 3: Add Redis methods**

Add methods to `nestjs/grab-service/src/grab/redis.service.ts`:

```ts
  async rpush(key: string, value: string): Promise<number> {
    return this.client.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async sadd(key: string, value: string): Promise<number> {
    return this.client.sadd(key, value);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, value: string): Promise<number> {
    return this.client.srem(key, value);
  }

  async hset(key: string, value: Record<string, string>): Promise<number> {
    return this.client.hset(key, value);
  }
```

- [ ] **Step 4: Implement queue service**

Create `nestjs/grab-service/src/grab/grab-queue.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface EnqueueGrabInput {
  requestId: string;
  sessionId: number;
  userId: number;
}

export interface EnqueueGrabResult {
  queueSeq: number;
  queueRank: number;
}

@Injectable()
export class GrabQueueService {
  constructor(private readonly redisService: RedisService) {}

  async enqueue(input: EnqueueGrabInput): Promise<EnqueueGrabResult> {
    const queueSeq = await this.redisService.incr(this.queueSeqKey(input.sessionId));
    await this.redisService.rpush(this.queueKey(input.sessionId), input.requestId);
    await this.redisService.sadd('grab:active-sessions', String(input.sessionId));
    await this.redisService.hset(this.requestKey(input.requestId), {
      requestId: input.requestId,
      sessionId: String(input.sessionId),
      userId: String(input.userId),
      queueSeq: String(queueSeq),
      status: 'QUEUED',
    });
    return { queueSeq, queueRank: await this.getQueueRank(input.sessionId, queueSeq) };
  }

  async dequeue(sessionId: number): Promise<string | null> {
    return this.redisService.lpop(this.queueKey(sessionId));
  }

  async activeSessions(): Promise<number[]> {
    const values = await this.redisService.smembers('grab:active-sessions');
    return values.map(Number).filter((value) => Number.isInteger(value) && value > 0);
  }

  async getQueueRank(sessionId: number, queueSeq: number | null): Promise<number | null> {
    if (queueSeq == null) return null;
    const processed = Number(await this.redisService.get(this.processedKey(sessionId)) ?? '0');
    return Math.max(queueSeq - processed - 1, 0);
  }

  async markProcessed(sessionId: number, queueSeq: number | null): Promise<void> {
    if (queueSeq == null) return;
    const key = this.processedKey(sessionId);
    const current = Number(await this.redisService.get(key) ?? '0');
    if (queueSeq > current) {
      await this.redisService.set(key, String(queueSeq));
    }
  }

  private queueKey(sessionId: number): string {
    return `grab:queue:${sessionId}`;
  }

  private queueSeqKey(sessionId: number): string {
    return `grab:queue:seq:${sessionId}`;
  }

  private processedKey(sessionId: number): string {
    return `grab:queue:processed:${sessionId}`;
  }

  private requestKey(requestId: string): string {
    return `grab:req:${requestId}`;
  }
}
```

- [ ] **Step 5: Register queue service**

Modify `nestjs/grab-service/src/grab/grab.module.ts` providers:

```ts
providers: [
  GrabService,
  GrabRepository,
  GrabAdmissionService,
  GrabCompensationService,
  GrabQueueService,
  OrderClientService,
  RedisService,
],
```

Add import:

```ts
import { GrabQueueService } from './grab-queue.service';
```

- [ ] **Step 6: Run queue tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-queue.service.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/redis.service.ts nestjs/grab-service/src/grab/grab-queue.service.ts nestjs/grab-service/src/grab/grab-queue.service.spec.ts nestjs/grab-service/src/grab/grab.module.ts
git commit -m "feat: add grab redis queue service"
```

---

### Task 3: Persist Async Progress In Grab Repository

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.spec.ts`

- [ ] **Step 1: Write failing repository tests**

Add to `nestjs/grab-service/src/grab/grab.repository.spec.ts`:

```ts
it('inserts queued requests with queue and preference metadata', async () => {
  const query = jest.fn().mockResolvedValue({
    rows: [{
      id: 1,
      request_id: 'GRAB1',
      idempotency_key: 'idem-1',
      user_id: 2004,
      session_id: 101,
      ticket_type_id: 1,
      quantity: 2,
      seat_ids: '[]',
      allocate_random: true,
      status: 'QUEUED',
      progress_status: 'QUEUED',
      progress_message: '你前面还有 11 人',
      order_id: null,
      fail_reason: null,
      request_type: 'NORMAL_GRAB',
      queue_seq: 12,
      requested_ticket_types: '[{"ticketTypeId":1,"name":"A档","maxPrice":1280}]',
      allow_auto_downgrade: true,
      current_ticket_type_id: 1,
      current_attempt_index: 0,
      matched_ticket_type_id: null,
      attempts_snapshot: '[]',
      worker_id: null,
      worker_claimed_at: null,
      processing_started_at: null,
      completed_at: null,
      expire_time: new Date('2026-05-29T12:15:00.000Z'),
      created_at: new Date('2026-05-29T12:00:00.000Z'),
      updated_at: new Date('2026-05-29T12:00:00.000Z'),
    }],
  });
  const repository = new GrabRepository({ query } as any);

  const result = await repository.createQueued({
    requestId: 'GRAB1',
    idempotencyKey: 'idem-1',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 1,
    quantity: 2,
    seatIds: [],
    allocateRandom: true,
    queueSeq: 12,
    requestedTicketTypes: [{ ticketTypeId: 1, name: 'A档', maxPrice: 1280 }],
    allowAutoDowngrade: true,
    expireTime: new Date('2026-05-29T12:15:00.000Z'),
  });

  expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into grab_request'), expect.arrayContaining([
    'GRAB1',
    'idem-1',
    2004,
    101,
    1,
    2,
    JSON.stringify([]),
    true,
    'QUEUED',
    'QUEUED',
    12,
    JSON.stringify([{ ticketTypeId: 1, name: 'A档', maxPrice: 1280 }]),
    true,
  ]));
  expect(result.progressStatus).toBe('QUEUED');
  expect(result.queueSeq).toBe(12);
  expect(result.requestedTicketTypes[0].name).toBe('A档');
});
```

Add a progress update test:

```ts
it('updates progress fields and attempt snapshot', async () => {
  const query = jest.fn().mockResolvedValue({
    rows: [{
      id: 1,
      request_id: 'GRAB1',
      idempotency_key: 'idem-1',
      user_id: 2004,
      session_id: 101,
      ticket_type_id: 1,
      quantity: 2,
      seat_ids: '[]',
      allocate_random: true,
      status: 'LOCKING',
      progress_status: 'LOCKING',
      progress_message: '正在为你锁票',
      order_id: null,
      fail_reason: null,
      request_type: 'NORMAL_GRAB',
      queue_seq: 12,
      requested_ticket_types: '[]',
      allow_auto_downgrade: false,
      current_ticket_type_id: 1,
      current_attempt_index: 0,
      matched_ticket_type_id: null,
      attempts_snapshot: '[{"ticketTypeId":1,"name":"A档","status":"LOCKING","message":"正在为你锁票"}]',
      worker_id: 'worker-1',
      worker_claimed_at: new Date('2026-05-29T12:00:00.000Z'),
      processing_started_at: new Date('2026-05-29T12:00:00.000Z'),
      completed_at: null,
      expire_time: new Date('2026-05-29T12:15:00.000Z'),
      created_at: new Date('2026-05-29T12:00:00.000Z'),
      updated_at: new Date('2026-05-29T12:01:00.000Z'),
    }],
  });
  const repository = new GrabRepository({ query } as any);

  const result = await repository.updateProgress('GRAB1', {
    status: 'LOCKING',
    message: '正在为你锁票',
    currentTicketTypeId: 1,
    currentAttemptIndex: 0,
    attempts: [{ ticketTypeId: 1, name: 'A档', status: 'LOCKING', message: '正在为你锁票' }],
  });

  expect(query).toHaveBeenCalledWith(expect.stringContaining('progress_status = $2'), [
    'GRAB1',
    'LOCKING',
    '正在为你锁票',
    1,
    0,
    JSON.stringify([{ ticketTypeId: 1, name: 'A档', status: 'LOCKING', message: '正在为你锁票' }]),
  ]);
  expect(result.attemptsSnapshot[0].status).toBe('LOCKING');
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.repository.spec.ts
```

Expected: FAIL because `createQueued` and `updateProgress` do not exist.

- [ ] **Step 3: Implement repository mapping and methods**

Modify `nestjs/grab-service/src/grab/grab.repository.ts`:

```ts
import { GRAB_STATUS, GrabStatus } from './grab-status';
import type {
  CreateQueuedGrabRequestInput,
  FindActiveGrabIntentInput,
  GrabAttemptSnapshot,
  GrabRequestRecord,
} from './grab.types';
```

Extend `GrabRequestRow` with the new snake_case fields, then add:

```ts
  async createQueued(input: CreateQueuedGrabRequestInput): Promise<GrabRequestRecord> {
    const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
    const message = `你前面还有 ${Math.max(input.queueSeq - 1, 0)} 人`;
    const result = await this.database.query<GrabRequestRow>(
      `insert into grab_request (
        request_id, idempotency_key, user_id, session_id, ticket_type_id,
        quantity, seat_ids, allocate_random, status, progress_status,
        progress_message, expire_time, request_type, queue_seq, requested_ticket_types,
        allow_auto_downgrade, current_ticket_type_id, current_attempt_index, attempts_snapshot
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb)
      returning *`,
      [
        input.requestId,
        input.idempotencyKey,
        input.userId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        JSON.stringify(normalizedSeatIds),
        input.allocateRandom,
        GRAB_STATUS.QUEUED,
        GRAB_STATUS.QUEUED,
        message,
        input.expireTime,
        'NORMAL_GRAB',
        input.queueSeq,
        JSON.stringify(input.requestedTicketTypes),
        input.allowAutoDowngrade,
        input.ticketTypeId,
        0,
        JSON.stringify(input.requestedTicketTypes.map((ticket) => ({
          ticketTypeId: ticket.ticketTypeId,
          name: ticket.name,
          status: 'PENDING',
          message: '待尝试',
        }))),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateProgress(requestId: string, input: {
    status: GrabStatus;
    message: string | null;
    currentTicketTypeId: number | null;
    currentAttemptIndex: number;
    attempts: GrabAttemptSnapshot[];
  }): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set status = $2,
           progress_status = $2,
           progress_message = $3,
           current_ticket_type_id = $4,
           current_attempt_index = $5,
           attempts_snapshot = $6::jsonb,
           updated_at = now()
       where request_id = $1
       returning *`,
      [
        requestId,
        input.status,
        input.message,
        input.currentTicketTypeId,
        input.currentAttemptIndex,
        JSON.stringify(input.attempts),
      ],
    );
    return this.mapRow(result.rows[0]);
  }
```

Update `markOrderCreated` to set progress and matched fields:

```ts
  async markOrderCreated(requestId: string, orderId: number, matchedTicketTypeId: number, attempts: GrabAttemptSnapshot[]): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set status = $2,
           progress_status = $2,
           order_id = $3,
           matched_ticket_type_id = $4,
           attempts_snapshot = $5::jsonb,
           fail_reason = null,
           completed_at = now(),
           updated_at = now()
       where request_id = $1
       returning *`,
      [requestId, GRAB_STATUS.ORDER_CREATED, orderId, matchedTicketTypeId, JSON.stringify(attempts)],
    );
    return this.mapRow(result.rows[0]);
  }
```

Update `mapRow` to parse JSON safely:

```ts
  private parseJsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string' && value.trim()) return JSON.parse(value) as T[];
    return [];
  }
```

Use it for `seatIds`, `requestedTicketTypes`, and `attemptsSnapshot`.

- [ ] **Step 4: Keep old callers compiling temporarily**

Keep `createPending` as a compatibility wrapper for tests not yet migrated:

```ts
  async createPending(input: Omit<CreateQueuedGrabRequestInput, 'queueSeq' | 'requestedTicketTypes' | 'allowAutoDowngrade'>): Promise<GrabRequestRecord> {
    return this.createQueued({
      ...input,
      queueSeq: 0,
      requestedTicketTypes: [{ ticketTypeId: input.ticketTypeId, name: null, maxPrice: null }],
      allowAutoDowngrade: false,
    });
  }
```

- [ ] **Step 5: Run repository tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.repository.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab.repository.ts nestjs/grab-service/src/grab/grab.repository.spec.ts
git commit -m "feat: persist grab queue progress"
```

---

### Task 4: Convert Submit To Enqueue-Only

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.controller.spec.ts`

- [ ] **Step 1: Replace synchronous submit test with enqueue test**

In `nestjs/grab-service/src/grab/grab.service.spec.ts`, replace `creates an order after redis admission succeeds` with:

```ts
it('enqueues a grab request and does not create an order during submit', async () => {
  const repository: any = {
    findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
    findActiveByIntent: jest.fn().mockResolvedValue(null),
    createQueued: jest.fn().mockResolvedValue({
      requestId: 'GRAB202605290001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [],
      allocateRandom: true,
      idempotencyKey: 'idem-1',
      status: GRAB_STATUS.QUEUED,
      progressStatus: GRAB_STATUS.QUEUED,
      progressMessage: '你前面还有 11 人',
      orderId: null,
      failReason: null,
      queueSeq: 12,
      requestedTicketTypes: [{ ticketTypeId: 202, name: null, maxPrice: null }],
      allowAutoDowngrade: false,
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      matchedTicketTypeId: null,
      attemptsSnapshot: [],
      updatedAt: new Date('2026-05-29T12:00:00.000Z'),
    }),
  };
  const admission: any = { admit: jest.fn(), release: jest.fn() };
  const orderClient: any = { createOrder: jest.fn() };
  const queue: any = {
    enqueue: jest.fn().mockResolvedValue({ queueSeq: 12, queueRank: 11 }),
    getQueueRank: jest.fn().mockResolvedValue(11),
  };
  const service = new GrabService(repository, admission, orderClient, queue);

  const result = await service.submitRequest(2004, {
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 2,
    allocateRandom: true,
    idempotencyKey: 'idem-1',
  });

  expect(admission.admit).not.toHaveBeenCalled();
  expect(orderClient.createOrder).not.toHaveBeenCalled();
  expect(queue.enqueue).toHaveBeenCalledWith({ requestId: expect.stringMatching(/^GRAB/), sessionId: 101, userId: 2004 });
  expect(repository.createQueued).toHaveBeenCalledWith(expect.objectContaining({
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    queueSeq: 12,
    requestedTicketTypes: [{ ticketTypeId: 202, name: null, maxPrice: null }],
    allowAutoDowngrade: false,
  }));
  expect(result).toEqual({
    requestId: 'GRAB202605290001',
    status: GRAB_STATUS.QUEUED,
    orderId: null,
    failReason: null,
    queueSeq: 12,
    queueRank: 11,
    estimatedWaitSeconds: null,
    message: '你前面还有 11 人',
  });
});
```

- [ ] **Step 2: Add validation tests for downgrade authorization**

Add:

```ts
it('rejects auto downgrade when explicit seats are selected', async () => {
  const service = new GrabService({} as any, {} as any, {} as any, {} as any);

  await expect(service.submitRequest(2004, {
    sessionId: 101,
    quantity: 2,
    seatIds: [301, 302],
    idempotencyKey: 'idem-seats',
    allowAutoDowngrade: true,
    ticketTypePreferences: [
      { ticketTypeId: 1, name: 'A档', maxPrice: 1280 },
      { ticketTypeId: 2, name: 'B档', maxPrice: 980 },
    ],
  })).rejects.toThrow('选座请求不支持自动降级');
});
```

- [ ] **Step 3: Run service tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.service.spec.ts
```

Expected: FAIL because `GrabService` constructor does not accept queue service and submit still calls admission/order.

- [ ] **Step 4: Implement enqueue-only submit**

Change constructor in `grab.service.ts`:

```ts
import { GrabQueueService } from './grab-queue.service';

constructor(
  private readonly repository: GrabRepository,
  private readonly admissionService: GrabAdmissionService,
  private readonly orderClient: OrderClientService,
  private readonly queueService: GrabQueueService,
) {}
```

In `submitRequest`, after active-intent reuse:

```ts
    const preferences = this.normalizePreferences(dto);
    const firstPreference = preferences[0];
    const requestId = this.generateRequestId();
    const queued = await this.queueService.enqueue({ requestId, sessionId: dto.sessionId, userId });
    const created = await this.repository.createQueued({
      requestId,
      idempotencyKey: dto.idempotencyKey,
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: firstPreference.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      allocateRandom,
      expireTime: new Date(Date.now() + this.requestTtlSeconds * 1000),
      queueSeq: queued.queueSeq,
      requestedTicketTypes: preferences,
      allowAutoDowngrade: Boolean(dto.allowAutoDowngrade) && preferences.length > 1,
    });
    return this.toResponse(created, queued.queueRank);
```

Remove admission/order work from submit; that code moves to worker in Task 6.

Add helper:

```ts
  private normalizePreferences(dto: SubmitGrabRequestDto): GrabTicketPreference[] {
    const raw = dto.ticketTypePreferences?.length
      ? dto.ticketTypePreferences
      : dto.ticketTypeId
        ? [{ ticketTypeId: dto.ticketTypeId }]
        : [];
    if (raw.length === 0) throw new BadRequestException('票档不能为空');
    if (dto.seatIds?.length && raw.length > 1) {
      throw new BadRequestException('选座请求不支持自动降级');
    }
    if (!dto.allowAutoDowngrade && raw.length > 1) {
      return [this.toPreference(raw[0])];
    }
    return raw.map((item) => this.toPreference(item));
  }

  private toPreference(item: TicketTypePreferenceDto): GrabTicketPreference {
    if (!Number.isInteger(item.ticketTypeId) || item.ticketTypeId <= 0) {
      throw new BadRequestException('票档不正确');
    }
    return {
      ticketTypeId: item.ticketTypeId,
      name: item.name ?? null,
      maxPrice: item.maxPrice ?? null,
    };
  }
```

Update `toResponse`:

```ts
  private toResponse(record: Pick<GrabRequestRecord, 'requestId' | 'status' | 'progressStatus' | 'orderId' | 'failReason' | 'queueSeq' | 'progressMessage'>, queueRank: number | null = null): GrabRequestResponse {
    return {
      requestId: record.requestId,
      status: record.progressStatus ?? record.status,
      orderId: record.orderId,
      failReason: record.failReason,
      queueSeq: record.queueSeq,
      queueRank,
      estimatedWaitSeconds: null,
      message: record.progressMessage,
    };
  }
```

- [ ] **Step 5: Update controller test response**

In `grab.controller.spec.ts`, use queued response:

```ts
submitRequest: jest.fn().mockResolvedValue({
  requestId: 'GRAB1',
  status: GRAB_STATUS.QUEUED,
  orderId: null,
  failReason: null,
  queueSeq: 1,
  queueRank: 0,
  estimatedWaitSeconds: null,
  message: '你前面还有 0 人',
}),
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.service.spec.ts grab.controller.spec.ts
```

Expected: PASS after removing or rewriting old synchronous expectations.

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab.service.ts nestjs/grab-service/src/grab/grab.service.spec.ts nestjs/grab-service/src/grab/grab.controller.spec.ts
git commit -m "feat: enqueue grab requests asynchronously"
```

---

### Task 5: Add Progress API

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.controller.ts`
- Modify: `nestjs/grab-service/src/grab/grab.controller.spec.ts`

- [ ] **Step 1: Write failing progress service test**

Add to `grab.service.spec.ts`:

```ts
it('returns progress with queue rank for the owner', async () => {
  const record: any = {
    requestId: 'GRAB1',
    userId: 2004,
    sessionId: 101,
    status: GRAB_STATUS.WAITING,
    progressStatus: GRAB_STATUS.WAITING,
    progressMessage: '你前面还有 3 人',
    orderId: null,
    failReason: null,
    queueSeq: 10,
    currentTicketTypeId: 1,
    currentAttemptIndex: 0,
    requestedTicketTypes: [{ ticketTypeId: 1, name: 'A档', maxPrice: 1280 }],
    attemptsSnapshot: [{ ticketTypeId: 1, name: 'A档', status: 'PENDING', message: '待尝试' }],
    matchedTicketTypeId: null,
    updatedAt: new Date('2026-05-29T12:00:00.000Z'),
  };
  const repository: any = { findByRequestId: jest.fn().mockResolvedValue(record) };
  const queue: any = { getQueueRank: jest.fn().mockResolvedValue(3) };
  const service = new GrabService(repository, {} as any, {} as any, queue);

  const result = await service.getProgress(2004, 'GRAB1');

  expect(queue.getQueueRank).toHaveBeenCalledWith(101, 10);
  expect(result.status).toBe(GRAB_STATUS.WAITING);
  expect(result.queueRank).toBe(3);
  expect(result.attempts[0].message).toBe('待尝试');
});
```

- [ ] **Step 2: Write failing controller test**

Add to `grab.controller.spec.ts`:

```ts
it('routes progress lookups through the authenticated user id', async () => {
  const service: any = {
    getProgress: jest.fn().mockResolvedValue({ requestId: 'GRAB1', status: GRAB_STATUS.WAITING, queueRank: 3 }),
  };
  const controller = new GrabController(service);

  const result = await controller.progress({ user: { userId: 2004 } } as any, 'GRAB1');

  expect(service.getProgress).toHaveBeenCalledWith(2004, 'GRAB1');
  expect(result).toEqual({ code: 200, message: 'success', data: { requestId: 'GRAB1', status: GRAB_STATUS.WAITING, queueRank: 3 } });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.service.spec.ts grab.controller.spec.ts
```

Expected: FAIL because `getProgress` and controller route do not exist.

- [ ] **Step 4: Implement progress service**

Add to `grab.service.ts`:

```ts
  async getProgress(userId: number, requestId: string): Promise<GrabProgressResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('抢票请求不存在');
    if (record.userId !== userId) throw new ForbiddenException('不能查看他人的抢票请求');
    const queueRank = await this.queueService.getQueueRank(record.sessionId, record.queueSeq);
    return {
      requestId: record.requestId,
      sessionId: record.sessionId,
      status: record.progressStatus,
      orderId: record.orderId,
      failReason: record.failReason,
      queueSeq: record.queueSeq,
      queueRank,
      estimatedWaitSeconds: null,
      currentTicketTypeId: record.currentTicketTypeId,
      currentAttemptIndex: record.currentAttemptIndex,
      requestedTicketTypes: record.requestedTicketTypes,
      attempts: record.attemptsSnapshot,
      visibleStock: null,
      message: record.progressMessage,
      matchedTicketTypeId: record.matchedTicketTypeId,
      updateTime: record.updatedAt.toISOString(),
    };
  }
```

- [ ] **Step 5: Implement controller route**

In `grab.controller.ts`, add:

```ts
  @Get(':requestId/progress')
  async progress(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string): Promise<ApiResult<GrabProgressResponse>> {
    return success(await this.grabService.getProgress(request.user.userId, requestId));
  }
```

Update imports:

```ts
import type { GrabProgressResponse, GrabRequestResponse, SubmitGrabRequestDto } from './grab.types';
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab.service.spec.ts grab.controller.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab.service.ts nestjs/grab-service/src/grab/grab.service.spec.ts nestjs/grab-service/src/grab/grab.controller.ts nestjs/grab-service/src/grab/grab.controller.spec.ts
git commit -m "feat: add grab progress polling api"
```

---

### Task 6: Implement Worker For Single-Ticket Processing

**Files:**
- Create: `nestjs/grab-service/src/grab/grab-worker.service.ts`
- Create: `nestjs/grab-service/src/grab/grab-worker.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/grab/grab.module.ts`

- [ ] **Step 1: Write failing worker success test**

Create `nestjs/grab-service/src/grab/grab-worker.service.spec.ts`:

```ts
import { GrabWorkerService } from './grab-worker.service';
import { GRAB_STATUS } from './grab-status';

function queuedRecord(overrides: any = {}) {
  return {
    requestId: 'GRAB1',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 1,
    quantity: 2,
    seatIds: [],
    allocateRandom: true,
    idempotencyKey: 'idem-1',
    queueSeq: 12,
    requestedTicketTypes: [{ ticketTypeId: 1, name: 'A档', maxPrice: 1280 }],
    allowAutoDowngrade: false,
    attemptsSnapshot: [{ ticketTypeId: 1, name: 'A档', status: 'PENDING', message: '待尝试' }],
    ...overrides,
  };
}

describe('GrabWorkerService', () => {
  it('locks a single ticket type and creates an order', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.ORDER_CREATED, orderId: 9001, matchedTicketTypeId: 1 }),
      updateStatus: jest.fn(),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', amount: 1960 }),
    };
    const queue: any = { markProcessed: jest.fn() };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(admission.admit).toHaveBeenCalledWith(expect.objectContaining({ ticketTypeId: 1, quantity: 2 }));
    expect(orderClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 1,
      quantity: 2,
      authorizedMaxUnitPrice: 1280,
      grabRequestId: 'GRAB1',
      requestedTicketTypeId: 1,
      matchedTicketTypeId: 1,
      autoDowngraded: false,
    }));
    expect(repository.markOrderCreated).toHaveBeenCalledWith('GRAB1', 9001, 1, expect.any(Array));
    expect(queue.markProcessed).toHaveBeenCalledWith(101, 12);
  });
});
```

- [ ] **Step 2: Run worker test and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-worker.service.spec.ts
```

Expected: FAIL because worker service does not exist.

- [ ] **Step 3: Add repository claim method**

Add to `grab.repository.ts`:

```ts
  async claimForProcessing(requestId: string, workerId: string): Promise<GrabRequestRecord | null> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set worker_id = $2,
           worker_claimed_at = now(),
           processing_started_at = coalesce(processing_started_at, now()),
           progress_status = $3,
           status = $3,
           updated_at = now()
       where request_id = $1
         and progress_status in ($4, $5)
       returning *`,
      [requestId, workerId, GRAB_STATUS.WAITING, GRAB_STATUS.QUEUED, GRAB_STATUS.WAITING],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
```

- [ ] **Step 4: Implement worker service**

Create `nestjs/grab-service/src/grab/grab-worker.service.ts`:

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabAttemptSnapshot, GrabRequestRecord, GrabTicketPreference } from './grab.types';
import { OrderClientService } from './order-client.service';

@Injectable()
export class GrabWorkerService implements OnModuleInit {
  private readonly logger = new Logger(GrabWorkerService.name);
  private readonly workerId = `grab-worker-${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
    private readonly queueService: GrabQueueService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.pollOnce().catch((error) => this.logger.error(error)), 500);
  }

  async pollOnce(): Promise<void> {
    for (const sessionId of await this.queueService.activeSessions()) {
      const requestId = await this.queueService.dequeue(sessionId);
      if (requestId) await this.processRequest(requestId);
    }
  }

  async processRequest(requestId: string): Promise<void> {
    const existing = await this.repository.findByRequestId(requestId);
    if (!existing) return;
    const record = await this.repository.claimForProcessing(requestId, this.workerId);
    if (!record) return;
    try {
      await this.processAttempts(record);
    } finally {
      await this.queueService.markProcessed(record.sessionId, record.queueSeq);
    }
  }

  private async processAttempts(record: GrabRequestRecord): Promise<void> {
    const preferences = record.allowAutoDowngrade ? record.requestedTicketTypes : record.requestedTicketTypes.slice(0, 1);
    const attempts = this.initialAttempts(preferences);
    const firstTicketTypeId = preferences[0]?.ticketTypeId ?? record.ticketTypeId;
    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.TRYING_TICKET_TYPE,
      message: `正在尝试${preferences[0]?.name ?? '当前票档'}`,
      currentTicketTypeId: firstTicketTypeId,
      currentAttemptIndex: 0,
      attempts: this.markAttempt(attempts, 0, 'TRYING', `正在尝试${preferences[0]?.name ?? '当前票档'}`),
    });
    await this.trySingleTicket(record, preferences[0], 0, attempts);
  }

  private async trySingleTicket(record: GrabRequestRecord, preference: GrabTicketPreference, index: number, attempts: GrabAttemptSnapshot[]): Promise<void> {
    const lockingAttempts = this.markAttempt(attempts, index, 'LOCKING', `正在为你锁定${preference.name ?? '当前票档'}`);
    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.LOCKING,
      message: `正在为你锁定${preference.name ?? '当前票档'}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: lockingAttempts,
    });
    const admission = await this.admissionService.admit({
      requestId: record.requestId,
      userId: record.userId,
      sessionId: record.sessionId,
      ticketTypeId: preference.ticketTypeId,
      quantity: record.quantity,
      seatIds: record.seatIds,
      idempotencyKey: record.idempotencyKey,
      ttlSeconds: 900,
    });
    if (admission.outcome !== 'ACCEPTED' && admission.outcome !== 'IDEMPOTENT') {
      await this.repository.updateStatus(record.requestId, admission.outcome === 'SOLD_OUT' ? GRAB_STATUS.SOLD_OUT : GRAB_STATUS.LIMITED, admission.outcome === 'SOLD_OUT' ? '票档已售罄' : '限购或座位已被锁定');
      return;
    }
    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.ORDER_CREATING,
      message: `${preference.name ?? '当前票档'}锁票成功，正在生成订单`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(lockingAttempts, index, 'LOCKING', `${preference.name ?? '当前票档'}锁票成功`),
    });
    try {
      const order = await this.orderClient.createOrder({
        userId: record.userId,
        sessionId: record.sessionId,
        ticketTypeId: preference.ticketTypeId,
        quantity: record.quantity,
        seatIds: record.seatIds,
        allocateRandom: record.allocateRandom,
        authorizedMaxUnitPrice: preference.maxPrice,
        grabRequestId: record.requestId,
        requestedTicketTypeId: record.ticketTypeId,
        matchedTicketTypeId: preference.ticketTypeId,
        autoDowngraded: preference.ticketTypeId !== record.ticketTypeId,
      });
      await this.repository.markOrderCreated(record.requestId, order.id, preference.ticketTypeId, this.markAttempt(lockingAttempts, index, 'ORDER_CREATED', `${preference.name ?? '当前票档'}已生成订单`));
    } catch (error) {
      await this.admissionService.release({
        userId: record.userId,
        sessionId: record.sessionId,
        ticketTypeId: preference.ticketTypeId,
        quantity: record.quantity,
        seatIds: record.seatIds,
        idempotencyKey: record.idempotencyKey,
        restoreStock: true,
      });
      const message = error instanceof Error ? error.message : '订单创建失败';
      await this.repository.updateStatus(record.requestId, GRAB_STATUS.FAILED, message);
    }
  }

  private initialAttempts(preferences: GrabTicketPreference[]): GrabAttemptSnapshot[] {
    return preferences.map((ticket) => ({
      ticketTypeId: ticket.ticketTypeId,
      name: ticket.name,
      status: 'PENDING',
      message: '待尝试',
    }));
  }

  private markAttempt(attempts: GrabAttemptSnapshot[], index: number, status: GrabAttemptSnapshot['status'], message: string): GrabAttemptSnapshot[] {
    return attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, status, message } : attempt);
  }
}
```

- [ ] **Step 5: Register worker**

Add to `grab.module.ts` providers:

```ts
GrabWorkerService,
```

And import:

```ts
import { GrabWorkerService } from './grab-worker.service';
```

- [ ] **Step 6: Run worker test and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-worker.service.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab-worker.service.ts nestjs/grab-service/src/grab/grab-worker.service.spec.ts nestjs/grab-service/src/grab/grab.repository.ts nestjs/grab-service/src/grab/grab.module.ts
git commit -m "feat: process grab queue requests"
```

---

### Task 7: Add Same-Session Auto Downgrade In Worker

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab-worker.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab-worker.service.spec.ts`

- [ ] **Step 1: Write failing downgrade success test**

Add to `grab-worker.service.spec.ts`:

```ts
it('downgrades to the next authorized ticket type after sold out', async () => {
  const record = queuedRecord({
    ticketTypeId: 1,
    requestedTicketTypes: [
      { ticketTypeId: 1, name: 'A档', maxPrice: 1280 },
      { ticketTypeId: 2, name: 'B档', maxPrice: 980 },
    ],
    allowAutoDowngrade: true,
    attemptsSnapshot: [
      { ticketTypeId: 1, name: 'A档', status: 'PENDING', message: '待尝试' },
      { ticketTypeId: 2, name: 'B档', status: 'PENDING', message: '待尝试' },
    ],
  });
  const repository: any = {
    findByRequestId: jest.fn().mockResolvedValue(record),
    claimForProcessing: jest.fn().mockResolvedValue(record),
    updateProgress: jest.fn().mockResolvedValue(record),
    markOrderCreated: jest.fn().mockResolvedValue({ ...record, orderId: 9002, matchedTicketTypeId: 2 }),
    updateStatus: jest.fn(),
  };
  const admission: any = {
    admit: jest.fn()
      .mockResolvedValueOnce({ outcome: 'SOLD_OUT', existingRequestId: null })
      .mockResolvedValueOnce({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
    release: jest.fn(),
  };
  const orderClient: any = {
    createOrder: jest.fn().mockResolvedValue({ id: 9002, orderNo: 'O2', amount: 1960 }),
  };
  const queue: any = { markProcessed: jest.fn() };
  const service = new GrabWorkerService(repository, admission, orderClient, queue);

  await service.processRequest('GRAB1');

  expect(admission.admit).toHaveBeenNthCalledWith(1, expect.objectContaining({ ticketTypeId: 1 }));
  expect(admission.admit).toHaveBeenNthCalledWith(2, expect.objectContaining({ ticketTypeId: 2 }));
  expect(orderClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({
    ticketTypeId: 2,
    authorizedMaxUnitPrice: 980,
    matchedTicketTypeId: 2,
    autoDowngraded: true,
  }));
  expect(repository.updateProgress).toHaveBeenCalledWith('GRAB1', expect.objectContaining({
    status: GRAB_STATUS.DOWNGRADING,
    message: 'A档已售罄，正在尝试B档',
  }));
});
```

- [ ] **Step 2: Write failing no-downgrade test**

Add:

```ts
it('marks sold out when downgrade is not authorized', async () => {
  const record = queuedRecord({
    requestedTicketTypes: [
      { ticketTypeId: 1, name: 'A档', maxPrice: 1280 },
      { ticketTypeId: 2, name: 'B档', maxPrice: 980 },
    ],
    allowAutoDowngrade: false,
  });
  const repository: any = {
    findByRequestId: jest.fn().mockResolvedValue(record),
    claimForProcessing: jest.fn().mockResolvedValue(record),
    updateProgress: jest.fn().mockResolvedValue(record),
    updateStatus: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.SOLD_OUT }),
  };
  const admission: any = {
    admit: jest.fn().mockResolvedValue({ outcome: 'SOLD_OUT', existingRequestId: null }),
    release: jest.fn(),
  };
  const orderClient: any = { createOrder: jest.fn() };
  const queue: any = { markProcessed: jest.fn() };
  const service = new GrabWorkerService(repository, admission, orderClient, queue);

  await service.processRequest('GRAB1');

  expect(admission.admit).toHaveBeenCalledTimes(1);
  expect(orderClient.createOrder).not.toHaveBeenCalled();
  expect(repository.updateStatus).toHaveBeenCalledWith('GRAB1', GRAB_STATUS.SOLD_OUT, '票档已售罄');
});
```

- [ ] **Step 3: Run worker tests and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-worker.service.spec.ts
```

Expected: FAIL because worker only tries the first preference.

- [ ] **Step 4: Implement downgrade loop**

In `GrabWorkerService.processAttempts`, replace single attempt call with loop:

```ts
    for (let index = 0; index < preferences.length; index++) {
      const preference = preferences[index];
      if (index > 0) {
        const previous = preferences[index - 1];
        await this.repository.updateProgress(record.requestId, {
          status: GRAB_STATUS.DOWNGRADING,
          message: `${previous.name ?? '上一档'}已售罄，正在尝试${preference.name ?? '下一档'}`,
          currentTicketTypeId: preference.ticketTypeId,
          currentAttemptIndex: index,
          attempts,
        });
      }
      const outcome = await this.tryTicketType(record, preference, index, attempts);
      if (outcome === 'ORDER_CREATED' || outcome === 'LIMITED' || outcome === 'FAILED') return;
      attempts = this.markAttempt(attempts, index, 'SOLD_OUT', `${preference.name ?? '当前票档'}已售罄`);
    }
    await this.repository.updateStatus(record.requestId, GRAB_STATUS.SOLD_OUT, '票档已售罄');
```

Rename `trySingleTicket` to `tryTicketType` and return:

```ts
Promise<'ORDER_CREATED' | 'SOLD_OUT' | 'LIMITED' | 'FAILED'>
```

Map admission outcomes:

```ts
    if (admission.outcome === 'SOLD_OUT') return 'SOLD_OUT';
    if (admission.outcome === 'LIMITED') {
      await this.repository.updateStatus(record.requestId, GRAB_STATUS.LIMITED, '限购或座位已被锁定');
      return 'LIMITED';
    }
    if (admission.outcome === 'STOCK_UNINITIALIZED') {
      await this.repository.updateStatus(record.requestId, GRAB_STATUS.FAILED, '抢票库存未初始化');
      return 'FAILED';
    }
```

After successful order:

```ts
      await this.repository.markOrderCreated(...);
      return 'ORDER_CREATED';
```

After order creation error:

```ts
      if (message.includes('库存') || message.includes('售罄')) return 'SOLD_OUT';
      await this.repository.updateStatus(record.requestId, message.includes('限购') ? GRAB_STATUS.LIMITED : GRAB_STATUS.FAILED, message);
      return message.includes('限购') ? 'LIMITED' : 'FAILED';
```

- [ ] **Step 5: Run worker tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- grab-worker.service.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab-worker.service.ts nestjs/grab-service/src/grab/grab-worker.service.spec.ts
git commit -m "feat: support authorized grab downgrades"
```

---

### Task 8: Add Ticket Metadata And Visible Stock API

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypeVisibleResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypesVisibleRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java`
- Create: `nestjs/grab-service/src/grab/ticket-client.service.ts`
- Create: `nestjs/grab-service/src/grab/ticket-client.service.spec.ts`
- Create: `nestjs/grab-service/src/grab/visible-stock.service.ts`
- Create: `nestjs/grab-service/src/grab/visible-stock.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.controller.ts`

- [ ] **Step 1: Write Java controller failing test**

Add to `TicketSalesInternalControllerTest`:

```java
@Test
void ticketTypesVisibleRejectsMissingToken() throws Exception {
    mockMvc.perform(post("/api/ticket/internal/sales/ticket-types-visible")
            .contentType("application/json")
            .content("{\"sessionId\":101,\"ticketTypeIds\":[1,2]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(403));
}

@Test
void ticketTypesVisibleReturnsMetadataWhenTokenValid() throws Exception {
    TicketTypeVisibleResponse first = new TicketTypeVisibleResponse();
    first.setTicketTypeId(1L);
    first.setName("A档");
    first.setPrice(new BigDecimal("1280.00"));
    first.setRemainStock(0);
    when(ticketSalesInternalService.listVisibleTicketTypes(any())).thenReturn(List.of(first));

    mockMvc.perform(post("/api/ticket/internal/sales/ticket-types-visible")
            .header("X-Internal-Token", "omni-local-internal-token")
            .contentType("application/json")
            .content("{\"sessionId\":101,\"ticketTypeIds\":[1]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(200))
        .andExpect(jsonPath("$.data[0].ticketTypeId").value(1))
        .andExpect(jsonPath("$.data[0].name").value("A档"));
}
```

- [ ] **Step 2: Implement Java DTOs and endpoint**

Create `TicketTypesVisibleRequest.java`:

```java
package com.omni.ticket.dto;

import java.util.List;

public class TicketTypesVisibleRequest {
    private Long sessionId;
    private List<Long> ticketTypeIds;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public List<Long> getTicketTypeIds() { return ticketTypeIds; }
    public void setTicketTypeIds(List<Long> ticketTypeIds) { this.ticketTypeIds = ticketTypeIds; }
}
```

Create `TicketTypeVisibleResponse.java`:

```java
package com.omni.ticket.dto;

import java.math.BigDecimal;

public class TicketTypeVisibleResponse {
    private Long ticketTypeId;
    private String name;
    private BigDecimal price;
    private Integer remainStock;

    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public Integer getRemainStock() { return remainStock; }
    public void setRemainStock(Integer remainStock) { this.remainStock = remainStock; }
}
```

Add service method:

```java
public List<TicketTypeVisibleResponse> listVisibleTicketTypes(TicketTypesVisibleRequest request) {
    if (request == null || request.getSessionId() == null || request.getTicketTypeIds() == null || request.getTicketTypeIds().isEmpty()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "票档参数不能为空");
    }
    List<TicketType> ticketTypes = ticketTypeMapper.selectBatchIds(request.getTicketTypeIds());
    return ticketTypes.stream()
            .filter(ticketType -> request.getSessionId().equals(ticketType.getSessionId()))
            .filter(ticketType -> Integer.valueOf(1).equals(ticketType.getStatus()))
            .map(ticketType -> {
                TicketTypeVisibleResponse response = new TicketTypeVisibleResponse();
                response.setTicketTypeId(ticketType.getId());
                response.setName(ticketType.getName());
                response.setPrice(ticketType.getPrice());
                response.setRemainStock(ticketType.getRemainStock());
                return response;
            })
            .collect(Collectors.toList());
}
```

Add imports for `TicketTypesVisibleRequest`, `TicketTypeVisibleResponse`, and `Collectors`.

Add controller method:

```java
@PostMapping("/ticket-types-visible")
public Result<List<TicketTypeVisibleResponse>> ticketTypesVisible(@RequestBody TicketTypesVisibleRequest request,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(service.listVisibleTicketTypes(request));
}
```

- [ ] **Step 3: Write Nest ticket client and visible stock tests**

Create `ticket-client.service.spec.ts`:

```ts
import { TicketClientService } from './ticket-client.service';

describe('TicketClientService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ORDER_SERVICE_URL: 'http://gateway.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: [{ ticketTypeId: 1, name: 'A档', price: 1280, remainStock: 87 }] }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('loads ticket metadata through internal ticket endpoint', async () => {
    const service = new TicketClientService();

    const result = await service.listVisibleTicketTypes(101, [1]);

    expect(global.fetch).toHaveBeenCalledWith('http://gateway.local/api/ticket/internal/sales/ticket-types-visible', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({ sessionId: 101, ticketTypeIds: [1] }),
    }));
    expect(result[0].name).toBe('A档');
  });
});
```

Create `visible-stock.service.spec.ts`:

```ts
import { VisibleStockService } from './visible-stock.service';

describe('VisibleStockService', () => {
  it('uses redis stock before db stock and maps available level', async () => {
    const redis: any = { get: jest.fn().mockResolvedValue('87') };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 1, name: 'A档', price: 1280, remainStock: 12 }]),
    };
    const service = new VisibleStockService(redis, ticketClient);

    const result = await service.getSessionVisibleStock(101, [1]);

    expect(result.ticketTypes[0]).toEqual({ ticketTypeId: 1, name: 'A档', visibleStock: 87, level: 'AVAILABLE' });
  });

  it('marks unknown when neither redis nor metadata stock exists', async () => {
    const redis: any = { get: jest.fn().mockResolvedValue(null) };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 1, name: 'A档', price: 1280, remainStock: null }]),
    };
    const service = new VisibleStockService(redis, ticketClient);

    const result = await service.getSessionVisibleStock(101, [1]);

    expect(result.ticketTypes[0].level).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 4: Implement Nest services and controller route**

Create `ticket-client.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

export interface TicketTypeVisibleInfo {
  ticketTypeId: number;
  name: string;
  price: number;
  remainStock: number | null;
}

@Injectable()
export class TicketClientService {
  private readonly baseUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async listVisibleTicketTypes(sessionId: number, ticketTypeIds: number[]): Promise<TicketTypeVisibleInfo[]> {
    if (!this.internalToken) throw new Error('票务内部接口令牌未配置');
    const response = await fetch(`${this.baseUrl}/api/ticket/internal/sales/ticket-types-visible`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify({ sessionId, ticketTypeIds }),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) throw new Error(result.message || '票务服务无响应');
    return result.data;
  }
}
```

Create `visible-stock.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TicketClientService } from './ticket-client.service';

export interface SessionVisibleStockResponse {
  sessionId: number;
  ticketTypes: Array<{ ticketTypeId: number; name: string; visibleStock: number | null; level: 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN' }>;
  snapshotTime: string;
}

@Injectable()
export class VisibleStockService {
  constructor(private readonly redisService: RedisService, private readonly ticketClient: TicketClientService) {}

  async getSessionVisibleStock(sessionId: number, ticketTypeIds: number[]): Promise<SessionVisibleStockResponse> {
    const metadata = await this.ticketClient.listVisibleTicketTypes(sessionId, ticketTypeIds);
    const ticketTypes = [];
    for (const ticket of metadata) {
      const redisStock = await this.redisService.get(`grab:stock:${sessionId}:${ticket.ticketTypeId}`);
      const visibleStock = redisStock != null ? Number(redisStock) : ticket.remainStock;
      ticketTypes.push({
        ticketTypeId: ticket.ticketTypeId,
        name: ticket.name,
        visibleStock: visibleStock == null ? null : visibleStock,
        level: this.level(visibleStock == null ? null : visibleStock),
      });
    }
    return { sessionId, ticketTypes, snapshotTime: new Date().toISOString() };
  }

  private level(stock: number | null): 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN' {
    if (stock == null || Number.isNaN(stock)) return 'UNKNOWN';
    if (stock <= 0) return 'SOLD_OUT';
    if (stock <= 10) return 'LOW';
    if (stock <= 50) return 'HOT';
    return 'AVAILABLE';
  }
}
```

Add controller route:

```ts
@Controller('api/grab/sessions')
@UseGuards(JwtAuthGuard)
export class GrabSessionController {
  constructor(private readonly visibleStockService: VisibleStockService) {}

  @Get(':sessionId/stock-visible')
  async stockVisible(@Param('sessionId') sessionId: string, @Query('ticketTypeIds') ticketTypeIds: string): Promise<ApiResult<SessionVisibleStockResponse>> {
    const ids = ticketTypeIds.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
    return success(await this.visibleStockService.getSessionVisibleStock(Number(sessionId), ids));
  }
}
```

If keeping one controller class is preferred, put this method in `GrabController` and change controller path handling carefully.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
cd java
mvn -pl java-ticket -Dtest=TicketSalesInternalControllerTest test
cd ..\nestjs\grab-service
npm test -- ticket-client.service.spec.ts visible-stock.service.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypeVisibleResponse.java java/java-ticket/src/main/java/com/omni/ticket/dto/TicketTypesVisibleRequest.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java nestjs/grab-service/src/grab/ticket-client.service.ts nestjs/grab-service/src/grab/ticket-client.service.spec.ts nestjs/grab-service/src/grab/visible-stock.service.ts nestjs/grab-service/src/grab/visible-stock.service.spec.ts nestjs/grab-service/src/grab/grab.controller.ts nestjs/grab-service/src/grab/grab.module.ts
git commit -m "feat: expose grab visible stock snapshots"
```

---

### Task 9: Add Order Price Authorization And Snapshot Fields

**Files:**
- Create: `sql/production-split/order/20260529_grab_order_snapshot.sql`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`

- [ ] **Step 1: Write failing price authorization test**

Add to `OrderServiceTest`:

```java
@Test
void createOrderRejectsWhenQuotePriceExceedsAuthorizedMax() {
    CreateOrderRequest request = new CreateOrderRequest();
    request.setUserId(2004L);
    request.setSessionId(101L);
    request.setTicketTypeId(1L);
    request.setQuantity(1);
    request.setAuthorizedMaxUnitPrice(new BigDecimal("980.00"));

    TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
    quote.setSessionId(101L);
    quote.setTicketTypeId(1L);
    quote.setUnitPrice(new BigDecimal("1280.00"));
    quote.setTicketName("A档");
    quote.setQuantity(1);
    quote.setActivityId(10L);
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

    BusinessException exception = assertThrows(BusinessException.class, () -> orderService.createOrder(request));

    assertTrue(exception.getMessage().contains("票价超过授权"));
    verify(orderMapper, never()).insert(any());
}
```

- [ ] **Step 2: Write failing snapshot metadata test**

Add:

```java
@Test
void createOrderWritesGrabSnapshotFields() {
    CreateOrderRequest request = new CreateOrderRequest();
    request.setUserId(2004L);
    request.setSessionId(101L);
    request.setTicketTypeId(2L);
    request.setQuantity(1);
    request.setAuthorizedMaxUnitPrice(new BigDecimal("980.00"));
    request.setGrabRequestId("GRAB1");
    request.setRequestedTicketTypeId(1L);
    request.setMatchedTicketTypeId(2L);
    request.setAutoDowngraded(true);

    TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
    quote.setSessionId(101L);
    quote.setTicketTypeId(2L);
    quote.setUnitPrice(new BigDecimal("980.00"));
    quote.setTicketName("B档");
    quote.setQuantity(1);
    quote.setActivityId(10L);
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
    when(ticketSalesInternalClient.lockStock(any(), anyString())).thenReturn(Result.success());

    orderService.createOrder(request);

    ArgumentCaptor<OrderSnapshot> snapshotCaptor = ArgumentCaptor.forClass(OrderSnapshot.class);
    verify(orderSnapshotMapper).insert(snapshotCaptor.capture());
    assertEquals("GRAB1", snapshotCaptor.getValue().getGrabRequestId());
    assertEquals(1L, snapshotCaptor.getValue().getRequestedTicketTypeId());
    assertEquals(2L, snapshotCaptor.getValue().getMatchedTicketTypeId());
    assertEquals(Boolean.TRUE, snapshotCaptor.getValue().getAutoDowngraded());
}
```

- [ ] **Step 3: Run Java tests and verify RED**

Run:

```powershell
cd java
mvn -pl java-order -Dtest=OrderServiceTest test
```

Expected: FAIL because DTO/entity fields and service validation do not exist.

- [ ] **Step 4: Add SQL migration**

Create `sql/production-split/order/20260529_grab_order_snapshot.sql`:

```sql
-- owner: java-order
alter table order_snapshot
    add column if not exists grab_request_id varchar(64),
    add column if not exists requested_ticket_type_id bigint,
    add column if not exists matched_ticket_type_id bigint,
    add column if not exists auto_downgraded boolean not null default false;

create index if not exists idx_order_snapshot_grab_request_id
    on order_snapshot(grab_request_id);
```

- [ ] **Step 5: Add DTO/entity fields**

Add to both `CreateOrderRequest` and `LockSeatsRequest`:

```java
private BigDecimal authorizedMaxUnitPrice;
private String grabRequestId;
private Long requestedTicketTypeId;
private Long matchedTicketTypeId;
private Boolean autoDowngraded;

public BigDecimal getAuthorizedMaxUnitPrice() { return authorizedMaxUnitPrice; }
public void setAuthorizedMaxUnitPrice(BigDecimal authorizedMaxUnitPrice) { this.authorizedMaxUnitPrice = authorizedMaxUnitPrice; }
public String getGrabRequestId() { return grabRequestId; }
public void setGrabRequestId(String grabRequestId) { this.grabRequestId = grabRequestId; }
public Long getRequestedTicketTypeId() { return requestedTicketTypeId; }
public void setRequestedTicketTypeId(Long requestedTicketTypeId) { this.requestedTicketTypeId = requestedTicketTypeId; }
public Long getMatchedTicketTypeId() { return matchedTicketTypeId; }
public void setMatchedTicketTypeId(Long matchedTicketTypeId) { this.matchedTicketTypeId = matchedTicketTypeId; }
public Boolean getAutoDowngraded() { return autoDowngraded; }
public void setAutoDowngraded(Boolean autoDowngraded) { this.autoDowngraded = autoDowngraded; }
```

Add matching fields/getters/setters to `OrderSnapshot` and `OrderListItemResponse`.

- [ ] **Step 6: Validate authorized price and write snapshot fields**

In `OrderService.createOrder` after quote:

```java
validateAuthorizedPrice(request.getAuthorizedMaxUnitPrice(), quote);
```

In `createOrderWithSeats` after quote:

```java
validateAuthorizedPrice(request.getAuthorizedMaxUnitPrice(), quote);
```

Add helper:

```java
private void validateAuthorizedPrice(BigDecimal authorizedMaxUnitPrice, TicketSalesQuoteResponse quote) {
    if (authorizedMaxUnitPrice == null || quote == null || quote.getUnitPrice() == null) {
        return;
    }
    if (quote.getUnitPrice().compareTo(authorizedMaxUnitPrice) > 0) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "票价超过授权");
    }
}
```

Change `writeSnapshot(order, quote)` calls to pass request metadata:

```java
writeSnapshot(order, quote, request.getGrabRequestId(), request.getRequestedTicketTypeId(), request.getMatchedTicketTypeId(), request.getAutoDowngraded());
```

Update method signature and fields:

```java
private void writeSnapshot(Order order, TicketSalesQuoteResponse quote, String grabRequestId, Long requestedTicketTypeId, Long matchedTicketTypeId, Boolean autoDowngraded) {
    ...
    snapshot.setGrabRequestId(grabRequestId);
    snapshot.setRequestedTicketTypeId(requestedTicketTypeId);
    snapshot.setMatchedTicketTypeId(matchedTicketTypeId);
    snapshot.setAutoDowngraded(Boolean.TRUE.equals(autoDowngraded));
    ...
}
```

- [ ] **Step 7: Select snapshot fields**

In `OrderMapper.ORDER_LIST_COLUMNS`, append:

```java
+ ", os.grab_request_id AS grabRequestId, os.requested_ticket_type_id AS requestedTicketTypeId, " +
"os.matched_ticket_type_id AS matchedTicketTypeId, os.auto_downgraded AS autoDowngraded "
```

- [ ] **Step 8: Run Java tests and commit**

Run:

```powershell
cd java
mvn -pl java-order -Dtest=OrderServiceTest,OrderListServiceTest test
```

Expected: PASS.

Commit:

```powershell
git add sql/production-split/order/20260529_grab_order_snapshot.sql java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java java/java-order/src/test/java/com/omni/order/service/OrderListServiceTest.java
git commit -m "feat: record grab ticket match on orders"
```

---

### Task 10: Send Grab Metadata From Order Client

**Files:**
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
- Modify: `nestjs/grab-service/src/grab/order-client.service.spec.ts`

- [ ] **Step 1: Write failing order client metadata test**

Add to `order-client.service.spec.ts`:

```ts
it('passes grab authorization and matched ticket metadata to order service', async () => {
  const service = new OrderClientService();

  await service.createOrder({
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 2,
    quantity: 1,
    seatIds: [],
    allocateRandom: false,
    authorizedMaxUnitPrice: 980,
    grabRequestId: 'GRAB1',
    requestedTicketTypeId: 1,
    matchedTicketTypeId: 2,
    autoDowngraded: true,
  });

  expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create', expect.objectContaining({
    body: JSON.stringify({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 2,
      quantity: 1,
      authorizedMaxUnitPrice: 980,
      grabRequestId: 'GRAB1',
      requestedTicketTypeId: 1,
      matchedTicketTypeId: 2,
      autoDowngraded: true,
    }),
  }));
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
cd nestjs/grab-service
npm test -- order-client.service.spec.ts
```

Expected: FAIL because the metadata fields are not part of `CreateOrderInput` or request body.

- [ ] **Step 3: Extend CreateOrderInput and body**

In `order-client.service.ts`, add optional fields:

```ts
  authorizedMaxUnitPrice?: number | null;
  grabRequestId?: string | null;
  requestedTicketTypeId?: number | null;
  matchedTicketTypeId?: number | null;
  autoDowngraded?: boolean;
```

Create a shared metadata object:

```ts
    const grabMetadata = {
      authorizedMaxUnitPrice: input.authorizedMaxUnitPrice,
      grabRequestId: input.grabRequestId,
      requestedTicketTypeId: input.requestedTicketTypeId,
      matchedTicketTypeId: input.matchedTicketTypeId,
      autoDowngraded: Boolean(input.autoDowngraded),
    };
```

Spread it into both seat and non-seat bodies.

- [ ] **Step 4: Run order-client tests and commit**

Run:

```powershell
cd nestjs/grab-service
npm test -- order-client.service.spec.ts
```

Expected: PASS.

Commit:

```powershell
git add nestjs/grab-service/src/grab/order-client.service.ts nestjs/grab-service/src/grab/order-client.service.spec.ts
git commit -m "feat: pass grab metadata to orders"
```

---

### Task 11: Frontend Types And API Functions

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add frontend types**

Update `frontend/src/types/api.ts`:

```ts
export type GrabStatus =
  | 'QUEUED'
  | 'WAITING'
  | 'TRYING_TICKET_TYPE'
  | 'LOCKING'
  | 'ORDER_CREATING'
  | 'ORDER_CREATED'
  | 'SOLD_OUT'
  | 'DOWNGRADING'
  | 'FAILED'
  | 'LIMITED'
  | 'EXPIRED'
  | 'PENDING'
  | 'ACCEPTED'

export interface TicketTypePreferencePayload {
  ticketTypeId: number
  name?: string
  maxPrice?: number
}

export interface SubmitGrabRequestPayload {
  sessionId: number
  ticketTypeId?: number
  quantity: number
  seatIds?: number[]
  allocateRandom?: boolean
  idempotencyKey: string
  ticketTypePreferences?: TicketTypePreferencePayload[]
  allowAutoDowngrade?: boolean
}

export interface GrabAttemptProgress {
  ticketTypeId: number
  name: string | null
  status: 'PENDING' | 'TRYING' | 'LOCKING' | 'SOLD_OUT' | 'LIMITED' | 'FAILED' | 'ORDER_CREATED'
  message: string
}

export interface VisibleStockSnapshot {
  ticketTypeId: number
  visibleStock: number | null
  level: 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN'
  snapshotTime?: string
}

export interface GrabProgressResult extends GrabRequestResult {
  sessionId: number
  queueSeq: number | null
  queueRank: number | null
  estimatedWaitSeconds: number | null
  currentTicketTypeId: number | null
  currentAttemptIndex: number
  requestedTicketTypes: Array<{ ticketTypeId: number; name: string | null; maxPrice: number | null }>
  attempts: GrabAttemptProgress[]
  visibleStock: VisibleStockSnapshot | null
  message: string | null
  matchedTicketTypeId: number | null
  updateTime: string
}

export interface SessionVisibleStockResult {
  sessionId: number
  ticketTypes: Array<{ ticketTypeId: number; name: string; visibleStock: number | null; level: VisibleStockSnapshot['level'] }>
  snapshotTime: string
}
```

Add order fields:

```ts
  grabRequestId?: string | null
  requestedTicketTypeId?: number | null
  matchedTicketTypeId?: number | null
  autoDowngraded?: boolean | null
```

- [ ] **Step 2: Add API functions**

Update `frontend/src/lib/api.ts` imports and functions:

```ts
export async function getGrabProgress(requestId: string) {
  return request<import('@/types/api').GrabProgressResult>(`/api/grab/requests/${encodeURIComponent(requestId)}/progress`)
}

export async function getGrabVisibleStock(sessionId: number, ticketTypeIds: number[]) {
  const params = new URLSearchParams()
  params.set('ticketTypeIds', ticketTypeIds.join(','))
  return request<import('@/types/api').SessionVisibleStockResult>(`/api/grab/sessions/${sessionId}/stock-visible?${params.toString()}`)
}
```

- [ ] **Step 3: Typecheck and commit**

Run:

```powershell
cd frontend
pnpm typecheck
```

Expected: PASS.

Commit:

```powershell
git add frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add grab progress frontend api"
```

---

### Task 12: Frontend Activity Progress Modal

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: Add state and helpers**

Add imports:

```tsx
import { getActivityDetail, submitGrabRequest, getGrabProgress, getGrabVisibleStock, createAlipayQrPay, getSeatMap } from '@/lib/api'
import type { ActivityDetailVO, GrabProgressResult, QrPayResponse, SeatMapResponse, SessionDetail, SessionVisibleStockResult, SessionSeatVO, TicketTypeEntity } from '@/types/api'
```

Add state:

```tsx
const [allowAutoDowngrade, setAllowAutoDowngrade] = useState(false)
const [grabProgress, setGrabProgress] = useState<GrabProgressResult | null>(null)
const [grabProgressOpen, setGrabProgressOpen] = useState(false)
const [visibleStock, setVisibleStock] = useState<SessionVisibleStockResult | null>(null)
```

Add helper:

```tsx
const terminalGrabStatuses = new Set(['ORDER_CREATED', 'SOLD_OUT', 'LIMITED', 'FAILED', 'EXPIRED'])

const buildTicketTypePreferences = () => {
  if (!selectedSession || !selectedTicket) return []
  const sorted = selectedSession.ticketTypes
    .filter(ticket => ticket.id === selectedTicket.id || (allowAutoDowngrade && ticket.price <= selectedTicket.price))
    .sort((a, b) => {
      if (a.id === selectedTicket.id) return -1
      if (b.id === selectedTicket.id) return 1
      return b.price - a.price
    })
  return sorted.map(ticket => ({ ticketTypeId: ticket.id, name: ticket.name, maxPrice: ticket.price }))
}
```

- [ ] **Step 2: Fetch visible stock when session changes**

Add effect:

```tsx
useEffect(() => {
  if (!selectedSession?.ticketTypes.length) {
    setVisibleStock(null)
    return
  }
  const ids = selectedSession.ticketTypes.map(ticket => ticket.id)
  getGrabVisibleStock(selectedSession.session.id, ids)
    .then(setVisibleStock)
    .catch(() => setVisibleStock(null))
}, [selectedSession])
```

- [ ] **Step 3: Poll progress**

Add effect:

```tsx
useEffect(() => {
  if (!grabProgressOpen || !grabProgress?.requestId || terminalGrabStatuses.has(grabProgress.status)) return
  const timer = window.setInterval(() => {
    getGrabProgress(grabProgress.requestId)
      .then((progress) => {
        setGrabProgress(progress)
        if (progress.status === 'ORDER_CREATED' && progress.orderId) {
          window.clearInterval(timer)
          createAlipayQrPay(progress.orderId)
            .then((pay) => {
              setQrPay(pay)
              setGrabProgressOpen(false)
              setShowConfirm(false)
              resetGrabIdempotencyKey()
            })
            .catch((err: unknown) => setOrderError(err instanceof Error ? err.message : '支付创建失败'))
        }
      })
      .catch((err: unknown) => setOrderError(err instanceof Error ? err.message : '抢票进度查询失败'))
  }, 1000)
  return () => window.clearInterval(timer)
}, [grabProgressOpen, grabProgress?.requestId, grabProgress?.status])
```

- [ ] **Step 4: Update submit payload**

In `handleConfirmOrder`, replace submit payload with:

```tsx
const ticketTypePreferences = buildTicketTypePreferences()
const grab = await submitGrabRequest({
  sessionId: selectedSession.session.id,
  ticketTypeId: selectedTicket.id,
  ticketTypePreferences,
  allowAutoDowngrade: allowAutoDowngrade && !showsSeatCraftSelection,
  seatIds: allocation.seatIds,
  quantity,
  allocateRandom: allocation.allocateRandom,
  idempotencyKey,
})
setGrabProgress({
  ...grab,
  sessionId: selectedSession.session.id,
  queueSeq: grab.queueSeq ?? null,
  queueRank: grab.queueRank ?? null,
  estimatedWaitSeconds: grab.estimatedWaitSeconds ?? null,
  currentTicketTypeId: selectedTicket.id,
  currentAttemptIndex: 0,
  requestedTicketTypes: ticketTypePreferences.map(ticket => ({ ticketTypeId: ticket.ticketTypeId, name: ticket.name ?? null, maxPrice: ticket.maxPrice ?? null })),
  attempts: ticketTypePreferences.map(ticket => ({ ticketTypeId: ticket.ticketTypeId, name: ticket.name ?? null, status: 'PENDING', message: '待尝试' })),
  visibleStock: null,
  message: grab.message ?? null,
  matchedTicketTypeId: null,
  updateTime: new Date().toISOString(),
})
setGrabProgressOpen(true)
```

Remove the old `waitForGrabResult` call path.

- [ ] **Step 5: Add authorization UI**

In the confirm modal, after ticket line:

```tsx
{!showsSeatCraftSelection && selectedSession.ticketTypes.some(ticket => ticket.id !== selectedTicket.id && ticket.price <= selectedTicket.price) && (
  <label className="flex items-start gap-2 rounded border border-[#f0f0f0] p-3 text-[13px] text-[#666]">
    <input
      type="checkbox"
      checked={allowAutoDowngrade}
      onChange={(event) => {
        setAllowAutoDowngrade(event.target.checked)
        resetGrabIdempotencyKey()
      }}
      className="mt-0.5"
    />
    <span>
      允许自动尝试后续低价票档：
      {buildTicketTypePreferences().map(ticket => `${ticket.name ?? ticket.ticketTypeId} ¥${ticket.maxPrice ?? '-'}`).join(' / ')}
    </span>
  </label>
)}
```

- [ ] **Step 6: Add progress modal**

Near existing modals, add:

```tsx
{grabProgressOpen && grabProgress && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-[460px] rounded-lg bg-white p-6">
      <h3 className="mb-3 text-[18px] font-medium text-[#111]">
        {grabProgress.status === 'ORDER_CREATED' ? '已生成订单' : terminalGrabStatuses.has(grabProgress.status) ? '抢票结束' : '抢票中'}
      </h3>
      <div className="mb-4 rounded border border-[#f0f0f0] p-3 text-[14px] text-[#333]">
        {grabProgress.message || (grabProgress.queueRank != null ? `你前面还有 ${grabProgress.queueRank} 人` : '正在排队')}
      </div>
      <div className="mb-4 space-y-2">
        {grabProgress.attempts.map(attempt => (
          <div key={attempt.ticketTypeId} className="flex items-center justify-between text-[13px]">
            <span>{attempt.name ?? attempt.ticketTypeId}</span>
            <span className={attempt.status === 'SOLD_OUT' ? 'text-[#999]' : attempt.status === 'TRYING' || attempt.status === 'LOCKING' ? 'text-[#ff1268]' : 'text-[#666]'}>
              {attempt.message}
            </span>
          </div>
        ))}
      </div>
      {visibleStock && (
        <div className="mb-4 text-[12px] text-[#999]">
          库存变化较快，以锁票结果为准
        </div>
      )}
      <div className="flex justify-end gap-3">
        {!terminalGrabStatuses.has(grabProgress.status) && (
          <button onClick={() => grabProgress.requestId && cancelGrabRequest(grabProgress.requestId).then(setGrabProgress)} className="rounded border border-[#ddd] px-4 py-2 text-[14px] text-[#666]">取消抢票</button>
        )}
        {grabProgress.status === 'ORDER_CREATED' && grabProgress.orderId && (
          <button onClick={() => router.push(`/orders`)} className="rounded bg-[#ff1268] px-4 py-2 text-[14px] text-white">查看订单</button>
        )}
        {(grabProgress.status === 'SOLD_OUT' || grabProgress.status === 'FAILED' || grabProgress.status === 'LIMITED') && (
          <button onClick={() => setGrabProgressOpen(false)} className="rounded border border-[#ddd] px-4 py-2 text-[14px] text-[#666]">关闭</button>
        )}
      </div>
    </div>
  </div>
)}
```

Add `cancelGrabRequest` import if not already imported.

- [ ] **Step 7: Typecheck and commit**

Run:

```powershell
cd frontend
pnpm typecheck
```

Expected: PASS.

Commit:

```powershell
git add frontend/src/app/activity/[id]/page.tsx
git commit -m "feat: show grab progress polling modal"
```

---

### Task 13: Show Matched Ticket Type On Orders

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`
- Modify: `frontend/src/app/console/orders/page.tsx`

- [ ] **Step 1: Update order display logic**

In both order pages where ticket name is rendered, add a small marker:

```tsx
{order.autoDowngraded && (
  <span className="ml-2 rounded border border-[#ff1268] px-1.5 py-0.5 text-[11px] text-[#ff1268]">降级成功</span>
)}
```

If displaying ticket type id, prefer:

```tsx
{order.ticketName || (order.matchedTicketTypeId ? `票档 ${order.matchedTicketTypeId}` : `票档 ${order.ticketTypeId}`)}
```

- [ ] **Step 2: Typecheck and commit**

Run:

```powershell
cd frontend
pnpm typecheck
```

Expected: PASS.

Commit:

```powershell
git add frontend/src/app/orders/page.tsx frontend/src/app/console/orders/page.tsx
git commit -m "feat: show downgraded ticket orders"
```

---

### Task 14: Compensation And Verification

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab-compensation.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab-compensation.service.spec.ts`

- [ ] **Step 1: Update compensation tests for queued/claimed requests**

Add:

```ts
it('expires queued requests that pass their ttl before processing', async () => {
  const expiredQueued = {
    requestId: 'GRAB-QUEUED',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 1,
    quantity: 1,
    seatIds: [],
    idempotencyKey: 'idem-queued',
    orderId: null,
    progressStatus: GRAB_STATUS.QUEUED,
  };
  const repository: any = {
    findExpiredInFlight: jest.fn().mockResolvedValue([expiredQueued]),
    updateStatus: jest.fn().mockResolvedValue({ ...expiredQueued, progressStatus: GRAB_STATUS.EXPIRED }),
  };
  const admission: any = { release: jest.fn() };
  const service = new GrabCompensationService(repository, admission);

  await service.sweepExpiredRequests();

  expect(admission.release).not.toHaveBeenCalled();
  expect(repository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED', GRAB_STATUS.EXPIRED, '抢票请求已超时');
});
```

- [ ] **Step 2: Update repository expired query**

In `findExpiredInFlight`, include:

```sql
where progress_status in ($1, $2, $3, $4, $5)
```

With statuses:

```ts
[
  GRAB_STATUS.QUEUED,
  GRAB_STATUS.WAITING,
  GRAB_STATUS.TRYING_TICKET_TYPE,
  GRAB_STATUS.LOCKING,
  GRAB_STATUS.ORDER_CREATING,
]
```

Only release Redis holds for `LOCKING` or `ORDER_CREATING` records that have no order.

- [ ] **Step 3: Run grab-service tests**

Run:

```powershell
cd nestjs/grab-service
npm test
```

Expected: PASS.

- [ ] **Step 4: Run Java focused tests**

Run:

```powershell
cd java
mvn -pl java-order,java-ticket -Dtest=OrderServiceTest,OrderListServiceTest,TicketSalesInternalControllerTest test
```

Expected: PASS.

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd frontend
pnpm typecheck
node --test src/lib/*.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run boundary check**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: PASS, with no new cross-service Mapper, Entity, XML mapper, or SQL joins.

- [ ] **Step 7: Commit verification changes**

Commit:

```powershell
git add nestjs/grab-service/src/grab/grab-compensation.service.ts nestjs/grab-service/src/grab/grab-compensation.service.spec.ts nestjs/grab-service/src/grab/grab.repository.ts
git commit -m "fix: expire stalled grab progress"
```

---

## Final Verification Checklist

- [ ] `cd nestjs/grab-service && npm test`
- [ ] `cd java && mvn -pl java-order,java-ticket -Dtest=OrderServiceTest,OrderListServiceTest,TicketSalesInternalControllerTest test`
- [ ] `cd frontend && pnpm typecheck`
- [ ] `cd frontend && node --test src/lib/*.test.ts`
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- [ ] Manual browser flow: submit grab request, see `requestId`, queue position, progress attempts, and terminal result.
- [ ] Manual downgrade flow: A sold out, B succeeds, order displays actual B ticket and downgrade marker.
- [ ] Manual refresh flow: reload page during progress and recover by `requestId`.

## Self-Review

- Spec coverage: The plan covers async enqueue, queue sequence, progress API, worker processing, downgrade authorization, visible stock, order matched-ticket snapshot, frontend polling UI, timeout compensation, and verification.
- Placeholder scan: No task uses open-ended placeholder instructions without concrete code or command guidance.
- Type consistency: Shared names are `ticketTypePreferences`, `allowAutoDowngrade`, `authorizedMaxUnitPrice`, `grabRequestId`, `requestedTicketTypeId`, `matchedTicketTypeId`, and `autoDowngraded` across frontend, grab-service, and java-order.
- Boundary check: grab-service obtains ticket metadata through ticket internal API and creates orders through order internal API; it does not directly read or write ticket/order/user databases.
