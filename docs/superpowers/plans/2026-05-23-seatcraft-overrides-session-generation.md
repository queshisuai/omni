# SeatCraft Overrides Session Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 确保 SeatCraft `overrides` 中 `hidden` / `deleted` 坐标在场次一座一票生成时不会写入 `session_seat`，并且票档库存按可售座位数计算。

**Architecture:** 复用现有 `SeatCraftBlockLayoutService` 的 `seat_override` 持久化模型和 `SeatBlockGeometryService` 的几何生成入口。新增回归测试锁定两个边界：layout 保存/读取不吞 `hidden` / `deleted` 状态；`SessionBlockTicketStockService.generateForSession()` 生成座位和票档库存都基于 `SeatBlockGeometryService.generateSeats()` / `countSellableSeats()` 的过滤结果。

**Tech Stack:** Java 11, Spring Boot, MyBatis-Plus, JUnit 5, Mockito, Maven。

---

## File Structure

- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`
  - 责任：验证 block layout 的 `overrides` 持久化和读取保留 `hidden` / `deleted` 状态。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`
  - 责任：验证场次生成时隐藏/删除坐标不生成 `SessionSeat`，票档库存同步扣减。
- Modify if needed: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java`
  - 责任：只在测试发现状态未被正确保存/读取时修复。
- Modify if needed: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java`
  - 责任：只在测试发现 `hidden` / `deleted` 未被过滤或库存未扣减时修复。
- Modify if needed: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java`
  - 责任：只在测试发现生成路径绕过几何服务时修复。

## Task 1: 锁定 overrides 持久化状态

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`

- [ ] **Step 1: Write the failing/passing characterization test**

Add this test after `replaceLayoutPersistsBlocksOverridesAndTicketGroups()`:

```java
    @Test
    void replaceLayoutPersistsHiddenAndDeletedOverrideStatuses() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatCraftBlockDtos.OverrideRequest hidden = new SeatCraftBlockDtos.OverrideRequest();
        hidden.setBlockKey("block-a");
        hidden.setRowNo(1);
        hidden.setSeatNo(1);
        hidden.setStatus("hidden");
        SeatCraftBlockDtos.OverrideRequest deleted = new SeatCraftBlockDtos.OverrideRequest();
        deleted.setBlockKey("block-a");
        deleted.setRowNo(2);
        deleted.setSeatNo(2);
        deleted.setStatus("deleted");
        layout.setOverrides(List.of(hidden, deleted));
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatOverride> overrideCaptor = ArgumentCaptor.forClass(SeatOverride.class);
        verify(seatOverrideMapper, org.mockito.Mockito.times(2)).insert(overrideCaptor.capture());
        assertEquals(List.of("hidden", "deleted"), overrideCaptor.getAllValues().stream().map(SeatOverride::getStatus).toList());
        assertEquals(List.of(1, 2), overrideCaptor.getAllValues().stream().map(SeatOverride::getRowNo).toList());
        assertEquals(List.of(1, 2), overrideCaptor.getAllValues().stream().map(SeatOverride::getSeatNo).toList());
    }
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest#replaceLayoutPersistsHiddenAndDeletedOverrideStatuses"
```

Expected if existing persistence is correct:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if the test fails**

If the test fails because status is not preserved, update `SeatCraftBlockLayoutService.insertOverrides(...)` so it stores the trimmed incoming status with `visible` fallback:

```java
override.setStatus(defaultText(request.getStatus(), "visible"));
```

This line should already exist; do not change it if the test passes.

## Task 2: 锁定 getLayout 读取 hidden/deleted 状态

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`

- [ ] **Step 1: Write the layout readback test**

Add this test after `getLayoutLoadsBlocksOverridesAndTicketGroups()`:

```java
    @Test
    void getLayoutReturnsHiddenAndDeletedOverrideStatuses() {
        SeatBlock block = new SeatBlock();
        block.setId(101L);
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setColor("#34d399");
        block.setSort(0);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(block));

        SeatOverride hidden = new SeatOverride();
        hidden.setBlockId(101L);
        hidden.setRowNo(1);
        hidden.setSeatNo(1);
        hidden.setStatus("hidden");
        SeatOverride deleted = new SeatOverride();
        deleted.setBlockId(101L);
        deleted.setRowNo(2);
        deleted.setSeatNo(2);
        deleted.setStatus("deleted");
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(hidden, deleted));

        TicketGroup group = new TicketGroup();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockIds("block-a");
        group.setSort(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(group));

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals(List.of("hidden", "deleted"), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getStatus).toList());
        assertEquals(List.of(1, 2), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getRowNo).toList());
        assertEquals(List.of(1, 2), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getSeatNo).toList());
    }
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest#getLayoutReturnsHiddenAndDeletedOverrideStatuses"
```

Expected:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if the test fails**

If the test fails because status is lost, update `SeatCraftBlockLayoutService.toOverrideRequest(...)` to copy status:

```java
request.setStatus(override.getStatus());
```

This line should already exist; do not change it if the test passes.

## Task 3: 锁定场次生成过滤 hidden/deleted 并扣减库存

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`

- [ ] **Step 1: Write the generation regression test**

Add this test after `generateForSessionCreatesTicketTypeAndSeatsFromGridBlock()`:

```java
    @Test
    void generateForSessionSkipsHiddenAndDeletedOverrideSeatsAndAdjustsStock() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of(
                override(10L, 1, 2, "hidden"),
                override(10L, 2, 1, "deleted")
        ));
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        doAnswer(invocation -> {
            TicketType ticketType = invocation.getArgument(0);
            ticketType.setId(900L);
            return 1;
        }).when(ticketTypeMapper).insert(any(TicketType.class));

        int generated = service.generateForSession(99L);

        assertEquals(2, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> Integer.valueOf(2).equals(ticketType.getTotalStock())
                && Integer.valueOf(2).equals(ticketType.getRemainStock())));
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(2)).insert(seatCaptor.capture());
        assertEquals(List.of(1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedRowNo).toList());
        assertEquals(List.of(1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedSeatNo).toList());
    }
```

Add this helper near the existing `existingSeat(...)` helper:

```java
    private SeatOverride override(Long blockId, int rowNo, int seatNo, String status) {
        SeatOverride override = new SeatOverride();
        override.setBlockId(blockId);
        override.setRowNo(rowNo);
        override.setSeatNo(seatNo);
        override.setStatus(status);
        return override;
    }
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SessionBlockTicketStockServiceTest#generateForSessionSkipsHiddenAndDeletedOverrideSeatsAndAdjustsStock"
```

Expected if current generation path is correct:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if the test fails**

If hidden/deleted seats are inserted, update `SeatBlockGeometryService.isExcluded(...)` to treat both statuses as excluded:

```java
    private boolean isExcluded(SeatOverride override) {
        return override != null && ("hidden".equals(override.getStatus()) || "deleted".equals(override.getStatus()));
    }
```

If inventory remains 4 while generated seats are 2, update `SeatBlockGeometryService.countSellableSeats(...)` so non-standing blocks count generated seats:

```java
    public int countSellableSeats(SeatBlock block, List<SeatOverride> overrides) {
        requireBlock(block);
        if (STANDING.equals(block.getBlockType())) {
            return requirePositive(block.getCapacity(), "站区容量必须大于0");
        }
        return generateSeats(block, overrides).size();
    }
```

Both snippets should already exist; do not change production code if the test passes.

## Task 4: 锁定补生成路径也不会补回 hidden/deleted 坐标

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`

- [ ] **Step 1: Write the existing-session regression test**

Add this test after `generateForSessionCreatesOnlyMissingSeatsInsideExistingBlock()`:

```java
    @Test
    void generateForSessionDoesNotBackfillHiddenOrDeletedSeatsWhenSeatsAlreadyExist() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of(
                override(10L, 1, 2, "hidden"),
                override(10L, 2, 1, "deleted")
        ));
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        SessionSeat existing = new SessionSeat();
        existing.setSessionId(99L);
        existing.setSeatBlockId(10L);
        existing.setGeneratedRowNo(1);
        existing.setGeneratedSeatNo(1);
        existing.setStatus(1);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(existing));

        int generated = service.generateForSession(99L);

        assertEquals(1, generated);
        verify(ticketTypeMapper, never()).insert(any());
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper).insert(seatCaptor.capture());
        assertEquals(2, seatCaptor.getValue().getGeneratedRowNo());
        assertEquals(2, seatCaptor.getValue().getGeneratedSeatNo());
    }
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SessionBlockTicketStockServiceTest#generateForSessionDoesNotBackfillHiddenOrDeletedSeatsWhenSeatsAlreadyExist"
```

Expected:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if the test fails**

If hidden/deleted seats are backfilled, ensure `SessionBlockTicketStockService.generateMissingBlockSeats(...)` uses `geometryService.generateSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList()))` as the only source of candidate generated seats. The expected loop is:

```java
            for (SeatBlockGeometryService.GeneratedSeat seat : geometryService.generateSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList()))) {
                if (existingSeatKeys.contains(generatedSeatKey(seat))) {
                    continue;
                }
                sessionSeatMapper.insert(buildSessionSeat(session, ticketType.getId(), seat, now));
                generatedSeats++;
            }
```

This loop should already exist; do not change production code if the test passes.

## Task 5: Run focused verification

**Files:**
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java`

- [ ] **Step 1: Run service tests covering the full SeatCraft override flow**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest,SeatBlockGeometryServiceTest,SessionBlockTicketStockServiceTest"
```

Expected:

```text
Failures: 0, Errors: 0
BUILD SUCCESS
```

- [ ] **Step 2: Check the final diff is limited**

Run:

```powershell
git diff -- java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java java/java-ticket/src/test/java/com/omni/ticket/service/SessionBlockTicketStockServiceTest.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java
```

Expected: only the tests added above, unless a focused production fix was required by a failing test.

## Self-Review

- Spec coverage: covers persistence, readback, first generation, existing-session backfill, and stock adjustment.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: uses existing `SeatCraftBlockDtos.OverrideRequest`, `SeatOverride`, `SessionBlockTicketStockService.generateForSession`, `SeatBlockGeometryService.generateSeats`, and `countSellableSeats` signatures.
