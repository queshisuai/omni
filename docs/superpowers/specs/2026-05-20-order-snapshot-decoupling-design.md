# Order Snapshot Decoupling Design

## Goal

Phase D 将订单展示数据沉淀为 `java-order` 自有快照，移除订单列表和详情展示对票务表的运行时 Join。完成后，`java-order` 只依赖 `order`、`order_seat`、`order_snapshot` 展示订单历史，为后续 schema 隔离或物理拆库做准备。

本阶段继续保护现有 C 端购票闭环、订单回收站、B 端订单查看和 Phase C 的 ticket internal sales API，不修改前端交互，不引入消息队列，不物理拆库。

## Current Coupling

Phase A/B 已移除 `java-ticket -> user` 直接表访问。Phase C 已让 `java-order` 通过 `java-ticket` internal API 完成票价、库存、锁座、售出确认、释放和退款。

当前剩余主要耦合点是订单展示：`java-order` 的订单列表查询仍可能依赖 `session`、`activity`、`venue`、`ticket_type` 等票务表实时 Join。只要这些 Join 存在，订单服务仍不能独立迁移数据库，也无法保证历史订单展示不受票务数据变更影响。

## Target Boundary

`java-order` 拥有：

- `order`
- `order_seat`
- `order_snapshot`

`order_snapshot` 保存订单展示所需的票务上下文快照。票务服务的 ID 可以作为普通业务标识保存，但不能作为跨服务外键，也不能在运行时回查票务表补展示字段。

`java-ticket` 仍拥有：

- `tour`
- `station`
- `activity`
- `venue`
- `session`
- `ticket_type`
- `session_seat`
- SeatCraft 相关表

## Data Model

新增表：`order_snapshot`。

```sql
-- owner: java-order
CREATE TABLE IF NOT EXISTS order_snapshot (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    activity_id BIGINT,
    activity_name VARCHAR(255),
    activity_poster VARCHAR(500),
    tour_id BIGINT,
    station_id BIGINT,
    session_id BIGINT,
    session_time TIMESTAMP,
    venue_name VARCHAR(255),
    ticket_type_id BIGINT,
    ticket_name VARCHAR(255),
    unit_price NUMERIC(10, 2),
    quantity INTEGER,
    seat_labels TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE
);
```

Design choices:

- `order_id` references `"order"(id)` because both tables are owned by `java-order`.
- `activity_id`、`tour_id`、`station_id`、`session_id`、`ticket_type_id` are plain snapshot values, not foreign keys.
- `seat_labels` uses `TEXT` to keep the order service independent from ticket seat layout schema.
- `unit_price` stores the backend-trusted price returned by ticket quote.

## Write Flow

New order creation writes snapshot in the same order transaction.

```text
createOrder / createOrderWithSeats
-> order calls ticket quote
-> order locks stock or seats through ticket internal API
-> order inserts order
-> order inserts order_snapshot from quote response and selected seat labels
-> order inserts order_seat rows when seat-based
```

If snapshot insert fails, the order transaction must roll back. If ticket stock or seats were already locked before local rollback, order should attempt ticket release and log if release fails. A later compensation job can be added in a separate phase; this design only requires clear failure behavior and logging.

## Snapshot Source

`TicketSalesQuoteResponse` is the source of truth for new order snapshot fields. It already includes:

- `activityId`
- `activityName`
- `activityPoster`
- `venueName`
- `sessionTime`
- `ticketName`
- `unitPrice`

Phase D extends it only if missing fields are required:

- `tourId`
- `stationId`
- `seatLabels`

For seat-based orders, ticket service should return seat labels for requested seat IDs. For standing or stock-only orders, `seatLabels` remains empty.

## Read Flow

User-facing order list methods must query only order-owned tables:

- `"order"`
- `order_snapshot`
- `order_seat` if needed for local order seat state

The following runtime joins must be removed from `java-order` production SQL:

- `JOIN activity`
- `JOIN session`
- `JOIN venue`
- `JOIN ticket_type`
- direct reads from `session_seat`

`OrderMapper.selectVisibleOrderListItems` and `OrderMapper.selectTrashOrderListItems` should read display fields from `order_snapshot`.

## Historical Backfill

Add a migration SQL owned by `java-order` to backfill snapshots for existing orders. The migration may read current shared ticket tables once because it is a transitional data migration, not runtime service code.

Backfill sources:

- `"order"` for order ID, session ID, ticket type ID, quantity and amount.
- `session` for session time and activity ID.
- `activity` for activity name, poster, tour ID or station ID if present.
- `venue` for venue name.
- `ticket_type` for ticket name and unit price.
- `order_seat` + `session_seat` for seat labels.

Backfill must use `INSERT ... ON CONFLICT (order_id) DO UPDATE` so it is idempotent during local testing.

## Error Handling

- Missing ticket quote data should fail order creation before local order insert when possible.
- Snapshot insert failure should roll back local order creation.
- If local rollback happens after ticket locks were acquired, order should attempt ticket release and log any release failure with order number, ticket type ID and seat IDs.
- Order list should tolerate a missing snapshot for legacy data by returning empty display fields rather than joining ticket tables at runtime. The expected fix is running the backfill migration.

## DeepSeek Task Split

Tasks are intentionally small so DeepSeek can implement independently while the main agent reviews and verifies after each task.

### D1: SQL, Entity And Mapper

- Add migration SQL for `order_snapshot` creation and historical backfill.
- Add `OrderSnapshot` entity.
- Add `OrderSnapshotMapper`.
- Add basic compile or mapper-related tests.

### D2: Ticket Quote Snapshot Fields

- Extend ticket/order side quote DTOs with `tourId`、`stationId`、`seatLabels` if missing.
- Fill these fields in `TicketSalesInternalService.quote()`.
- Cover quote snapshot data with tests.

### D3: New Order Snapshot Writes

- Inject `OrderSnapshotMapper` into `OrderService`.
- Write `order_snapshot` during `createOrder` and `createOrderWithSeats`.
- Ensure snapshot write participates in order transaction.
- Update order creation tests.

### D4: Order List SQL Switch

- Change order list queries to join `order_snapshot`, not ticket tables.
- Keep response DTO shape stable for frontend.
- Update `OrderListServiceTest` and any mapper tests.

### D5: Boundary Guard And Verification

- Delete or stop using any order-side runtime ticket display SQL.
- Add/record grep checks for forbidden runtime joins.
- Run `mvn test -pl java-order -am` and `mvn test -pl java-ticket -am`.

## Acceptance Criteria

- `java-order` production code does not join `activity`、`session`、`venue`、`ticket_type` or read `session_seat` at runtime for order display.
- New orders create exactly one `order_snapshot` row.
- User visible and trash order lists read display fields from `order_snapshot`.
- Historical snapshot backfill SQL is idempotent.
- Existing frontend order page works without structural changes.
- `mvn test -pl java-order -am` passes.
- `mvn test -pl java-ticket -am` passes.
- `git diff --stat -- frontend` shows no frontend changes unless a later review finds a strict typing mismatch.

## Verification Commands

Run from `java/`:

```powershell
mvn test -pl java-order -am
mvn test -pl java-ticket -am
```

Run from repo root:

```powershell
Select-String -Path "java/java-order/src/main/java/**/*.java" -Pattern "JOIN activity|JOIN session|JOIN venue|JOIN ticket_type|session_seat" -SimpleMatch
git diff --stat -- frontend
```

Expected boundary check: no runtime production references, except comments or migration SQL outside `src/main/java`.

## Self Review

- No TBD or placeholder sections remain.
- Scope is limited to order snapshot decoupling and does not include physical database split.
- The design chooses a separate `order_snapshot` table to better support low coupling and future database ownership boundaries.
- Historical backfill is explicitly migration-only and not a runtime coupling exception.
- DeepSeek tasks are independent enough to implement sequentially with verification checkpoints.
