# Phase 4 Automatic Ticket Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将场次 SeatCraft blockLayout 自动展开为 `session_seat`，并基于 `ticket_group` 自动生成场次 `ticket_type` 库存。

**Architecture:** 在 `java-ticket` 内新增一个聚焦的服务，读取 `ownerType=session` 的 `seat_block`、`seat_override`、`ticket_group`，用现有 `SeatBlockGeometryService` 生成座位和库存。保留旧 section 流程，只有存在 session blockLayout 时走新流程。

**Tech Stack:** Java, Spring Boot, MyBatis-Plus, PostgreSQL, JUnit 5, Maven.

---

## File Structure

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`，补齐 Phase 1 已加数据库字段对应属性。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`，新增按 `ticket_group_key` 统计可售座位方法。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java`，负责 blockLayout 到 ticketType/sessionSeat 的展开。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`，当 session 有 blockLayout 时委托新服务生成座位。
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`，补委托测试。

## Task 1: Entity And Mapper Fields

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`

- [ ] **Step 1: Write a failing test through service expectations**

Add the first test in `SessionBlockTicketStockServiceTest` that captures inserted `SessionSeat` and asserts `seatBlockId`、`ticketGroupKey`、`generatedRowNo`、`generatedSeatNo` are populated.

- [ ] **Step 2: Run the test and verify it fails**

Run: `mvn test -pl java-ticket -am "-Dtest=SessionBlockTicketStockServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"`

Expected: compilation fails because `SessionSeat` does not expose the new fields or service does not exist.

- [ ] **Step 3: Add minimal fields**

Add to `SessionSeat`:

```java
private Long seatBlockId;
private String ticketGroupKey;
private Integer generatedRowNo;
private Integer generatedSeatNo;

public Long getSeatBlockId() { return seatBlockId; }
public void setSeatBlockId(Long seatBlockId) { this.seatBlockId = seatBlockId; }
public String getTicketGroupKey() { return ticketGroupKey; }
public void setTicketGroupKey(String ticketGroupKey) { this.ticketGroupKey = ticketGroupKey; }
public Integer getGeneratedRowNo() { return generatedRowNo; }
public void setGeneratedRowNo(Integer generatedRowNo) { this.generatedRowNo = generatedRowNo; }
public Integer getGeneratedSeatNo() { return generatedSeatNo; }
public void setGeneratedSeatNo(Integer generatedSeatNo) { this.generatedSeatNo = generatedSeatNo; }
```

Add to `SessionSeatMapper`:

```java
@Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} " +
        "AND ticket_group_key = #{ticketGroupKey} AND status = 1 AND order_id IS NULL " +
        "AND NOT EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = session_seat.id)")
Long countAvailableByTicketGroupKey(@Param("sessionId") Long sessionId,
                                    @Param("ticketGroupKey") String ticketGroupKey);
```

## Task 2: Automatic Ticket Type And Seat Generation

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`

- [ ] **Step 1: Write failing tests**

Tests must cover:
- grid block creates one `ticket_type` per active ticket group and inserts generated `session_seat` rows.
- standing block creates inventory-only `ticket_type` stock from capacity and inserts no `session_seat` rows.
- existing `session_seat` rows make generation idempotent and return 0.

- [ ] **Step 2: Implement minimal service**

Public API:

```java
@Transactional
public int generateForSession(Long sessionId)
```

Rules:
- Load `Session`; fail `404 场次不存在` if missing.
- If session already has any `session_seat`, return `0` to preserve current idempotent behavior.
- Load active `seat_block` where `owner_type='session'` and `owner_id=sessionId`.
- If no active blocks, return `0` so legacy section flow can continue.
- Load active `ticket_group` for session.
- Create one `ticket_type` per active group with `name=group.name` and `price=activityPrice` fallback `defaultPrice` fallback `0`.
- For seat blocks, call `SeatBlockGeometryService.generateSeats()` and insert `SessionSeat` with `seatBlockId`、`ticketGroupKey`、`generatedRowNo`、`generatedSeatNo` and matching `ticketTypeId`.
- For standing blocks, do not insert individual seats; add `capacity` to that ticket group stock.
- Set `ticket_type.totalStock` and `remainStock` to computed group inventory.

## Task 3: Wire Into SessionSeatLayoutService

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`

- [ ] **Step 1: Write failing delegation test**

Add a test that configures `blockLayoutService.getLayout("session", 99L)` to return a non-null block layout and verifies `generateSessionSeats(99L)` delegates to `SessionBlockTicketStockService.generateForSession(99L)` instead of legacy section generation.

- [ ] **Step 2: Implement constructor dependency and delegation**

Add optional `SessionBlockTicketStockService` dependency. In `generateSessionSeats`, after confirming the active layout exists and before reading legacy sections, call the new service when `blockLayoutService.getLayout("session", sessionId)` is not null.

## Task 4: Verification

- [ ] **Step 1: Run targeted tests**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -am "-Dtest=SessionBlockTicketStockServiceTest,SessionSeatLayoutServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run java-ticket full tests**

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Run frontend typecheck**

Run from `C:\Users\Administrator\Desktop\omni\frontend`:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` exits 0.

## Self-Review

- Spec coverage: covers Phase 4 backend foundation for automatic ticket type, block seat expansion, and standing capacity.
- Scope intentionally excludes order-service locking changes beyond existing seat-based flow; that will be handled after generated ticket types/seats exist.
- No placeholders remain; file paths and commands are explicit.
