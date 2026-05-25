# SeatCraft Single Seat Free Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SeatCraft 设计器中支持拖动单个未售座位到任意画布位置，并通过现有 `SeatOverride.dx/dy` 保存。

**Architecture:** 复用现有 block layout 和 `seat_override` 存储，不新增表。前端给每个生成座位补充 `baseX/baseY`，新增 `seatMove` 工具模式并在拖动完成时更新对应 block 的 override；后端只补充测试锁定 `dx/dy` 存取、生成和库存行为。

**Tech Stack:** Next.js 16, React 19, TypeScript, Java 11, Spring Boot, MyBatis-Plus, JUnit 5, Mockito, Maven, pnpm。

---

## File Structure

- Modify: `frontend/src/components/seatcraft/types.ts`
  - 扩展 `SeatCraftSeat` 增加 `baseX/baseY`。
  - 扩展 `SeatCanvasProps.toolMode` 增加 `seatMove`。
  - 增加 `SeatCanvasProps.onSeatMove` 回调。
- Modify: `frontend/src/components/seatcraft/block-layout.ts`
  - `buildSeat()` 输出 `baseX/baseY`。
  - 保持最终 `x/y = base + dx/dy`。
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx`
  - 增加单座 drag 状态。
  - 在 `seatMove` 模式下拖动未售、未删除座位。
  - 拖动完成后调用 `onSeatMove(...)`。
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
  - 增加 `seatMove` 工具按钮。
  - 实现 `onSeatMove`，写入或更新 block override。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`
  - 增加 `dx/dy` 保存和读取回归测试。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`
  - 增加大偏移生成坐标和库存不变测试。
- Modify if needed: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java`
  - 仅当测试失败时修复 `dx/dy` 保存/读取。
- Modify if needed: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java`
  - 仅当测试失败时修复 `base + dx/dy` 生成行为。

## Task 1: 后端锁定 dx/dy 持久化

**Files:**
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`

- [ ] **Step 1: Write the focused persistence test**

Add after `replaceLayoutPersistsHiddenAndDeletedOverrideStatuses()`:

```java
    @Test
    void replaceLayoutPersistsSeatOverrideOffsetForFreeMovedSeat() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatCraftBlockDtos.OverrideRequest moved = new SeatCraftBlockDtos.OverrideRequest();
        moved.setBlockKey("block-a");
        moved.setRowNo(1);
        moved.setSeatNo(2);
        moved.setStatus("visible");
        moved.setDx(new BigDecimal("123.5"));
        moved.setDy(new BigDecimal("-45.25"));
        moved.setCustomLabel("A02");
        layout.setOverrides(List.of(moved));
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatOverride> overrideCaptor = ArgumentCaptor.forClass(SeatOverride.class);
        verify(seatOverrideMapper).insert(overrideCaptor.capture());
        SeatOverride override = overrideCaptor.getValue();
        assertEquals(new BigDecimal("123.5"), override.getDx());
        assertEquals(new BigDecimal("-45.25"), override.getDy());
        assertEquals("visible", override.getStatus());
        assertEquals("A02", override.getCustomLabel());
    }
```

- [ ] **Step 2: Run the test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest#replaceLayoutPersistsSeatOverrideOffsetForFreeMovedSeat"
```

Expected:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if test fails**

If `dx/dy` are not saved, update `SeatCraftBlockLayoutService.insertOverrides(...)`:

```java
override.setDx(defaultDecimal(request.getDx(), BigDecimal.ZERO));
override.setDy(defaultDecimal(request.getDy(), BigDecimal.ZERO));
```

These lines should already exist.

## Task 2: 后端锁定 dx/dy 读取

**Files:**
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`

- [ ] **Step 1: Write the readback test**

Add after `getLayoutReturnsHiddenAndDeletedOverrideStatuses()`:

```java
    @Test
    void getLayoutReturnsSeatOverrideOffsetForFreeMovedSeat() {
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

        SeatOverride moved = new SeatOverride();
        moved.setBlockId(101L);
        moved.setRowNo(1);
        moved.setSeatNo(2);
        moved.setStatus("visible");
        moved.setDx(new BigDecimal("123.5"));
        moved.setDy(new BigDecimal("-45.25"));
        moved.setCustomLabel("A02");
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(moved));

        TicketGroup group = new TicketGroup();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockIds("block-a");
        group.setSort(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(group));

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals(new BigDecimal("123.5"), result.getOverrides().get(0).getDx());
        assertEquals(new BigDecimal("-45.25"), result.getOverrides().get(0).getDy());
        assertEquals("A02", result.getOverrides().get(0).getCustomLabel());
    }
```

- [ ] **Step 2: Run the test**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest#getLayoutReturnsSeatOverrideOffsetForFreeMovedSeat"
```

Expected:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if test fails**

If `dx/dy` are not returned, update `SeatCraftBlockLayoutService.toOverrideRequest(...)`:

```java
request.setDx(override.getDx());
request.setDy(override.getDy());
```

These lines should already exist.

## Task 3: 后端锁定移动座位生成坐标和库存

**Files:**
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`

- [ ] **Step 1: Write geometry tests**

Add after `visibleOverrideCanMoveAndRenameSeat()`:

```java
    @Test
    void visibleOverrideCanMoveSeatToArbitraryCanvasPosition() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(gridBlock(),
                List.of(override(1, 1, "visible", new BigDecimal("350"), new BigDecimal("-120"), null)));

        assertEquals(450.0, seats.get(0).getX());
        assertEquals(80.0, seats.get(0).getY());
        assertEquals(6, seats.size());
    }

    @Test
    void movedVisibleOverrideDoesNotChangeSellableSeatCount() {
        int stock = service.countSellableSeats(gridBlock(),
                List.of(override(1, 1, "visible", new BigDecimal("350"), new BigDecimal("-120"), null)));

        assertEquals(6, stock);
    }
```

- [ ] **Step 2: Run geometry tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatBlockGeometryServiceTest#visibleOverrideCanMoveSeatToArbitraryCanvasPosition,SeatBlockGeometryServiceTest#movedVisibleOverrideDoesNotChangeSellableSeatCount"
```

Expected:

```text
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Fix only if tests fail**

If generated coordinates ignore offsets, update `SeatBlockGeometryService.buildSeat(...)`:

```java
double dx = override == null ? 0 : decimal(override.getDx(), 0);
double dy = override == null ? 0 : decimal(override.getDy(), 0);
return new GeneratedSeat(row, seat, label, x + dx, y + dy,
        block.getId(), block.getBlockKey(), block.getTicketGroupKey());
```

This behavior should already exist.

## Task 4: 前端类型支持单座移动

**Files:**
- Modify: `frontend/src/components/seatcraft/types.ts`

- [ ] **Step 1: Update types**

Change `SeatCraftSeat`:

```ts
export interface SeatCraftSeat {
  id: string
  sessionSeatId?: number
  row: number
  col: number
  x: number
  y: number
  baseX?: number
  baseY?: number
  angle: number
  status: SeatStatus
  price?: number
  sectionKey: string
  sectionName: string
  label: string
}
```

Add a reusable tool mode type near `SeatCanvasInteractionMode`:

```ts
export type SeatCanvasToolMode = 'pointer' | 'eraser' | 'seatMove'
```

Change `SeatCanvasProps`:

```ts
  onSeatMove?: (blockKey: string, rowNo: number, seatNo: number, x: number, y: number, baseX: number, baseY: number) => void
  toolMode?: SeatCanvasToolMode
```

- [ ] **Step 2: Run typecheck and expect current callers to compile or reveal missing changes**

Run:

```powershell
pnpm typecheck
```

Expected at this intermediate step: it may fail because `SeatCanvas.tsx` and `SeatLayoutDesigner.tsx` still use the old union type. Continue to Task 5.

## Task 5: 前端输出座位基准坐标

**Files:**
- Modify: `frontend/src/components/seatcraft/block-layout.ts`

- [ ] **Step 1: Update `buildSeat()` to include base coordinates**

Replace the returned object in `buildSeat(...)` with:

```ts
  return {
    id,
    row: rowNo - 1,
    col: seatNo - 1,
    x: x + (override?.dx ?? 0),
    y: y + (override?.dy ?? 0),
    baseX: x,
    baseY: y,
    angle,
    status: excluded ? 'deleted' : (selectedSeatIds.includes(id) ? 'selected' : 'available'),
    price: 0,
    sectionKey: block.blockKey,
    sectionName: block.name,
    label: override?.customLabel?.trim() || `${rowNo}排${seatNo}座`,
  }
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: may still fail until Task 6 updates `SeatCanvas.tsx`.

## Task 6: 前端实现 SeatCanvas 单座拖动

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx`

- [ ] **Step 1: Import tool mode type**

Change import:

```ts
import type { SeatBlockDraft, SeatCanvasProps, SeatCanvasToolMode, SeatCraftSeat } from './types'
```

- [ ] **Step 2: Extend DragTarget**

Add to `DragTarget` union:

```ts
  | { type: 'seat'; blockKey: string; rowNo: number; seatNo: number; startX: number; startY: number; originX: number; originY: number; baseX: number; baseY: number }
```

- [ ] **Step 3: Destructure `onSeatMove`**

Add to props destructuring:

```ts
  onSeatMove,
```

- [ ] **Step 4: Add seat drag starter**

Add near `startBlockResize(...)`:

```ts
  const startSeatDrag = (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => {
    event.stopPropagation()
    if (!isDesignMode || toolMode !== 'seatMove') return
    if (seat.status === 'occupied' || seat.status === 'deleted') return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({
      type: 'seat',
      blockKey: block.blockKey,
      rowNo: seat.row + 1,
      seatNo: seat.col + 1,
      startX: point.x,
      startY: point.y,
      originX: seat.x,
      originY: seat.y,
      baseX: seat.baseX ?? seat.x,
      baseY: seat.baseY ?? seat.y,
    })
  }
```

- [ ] **Step 5: Handle seat movement**

In `handlePointerMove(...)`, after canvas/rotate/resize/marquee branches and before generic block movement, insert:

```ts
    if (drag.type === 'seat') {
      const point = pointFromEvent(event)
      const x = Math.round(drag.originX + point.x - drag.startX)
      const y = Math.round(drag.originY + point.y - drag.startY)
      onSeatMove?.(drag.blockKey, drag.rowNo, drag.seatNo, x, y, drag.baseX, drag.baseY)
      return
    }
```

- [ ] **Step 6: Pass seat drag callback to renderBlock**

Change the `blocks.map(...)` call to include `startSeatDrag` before `onSeatClick`:

```tsx
{blocks.map(block => renderBlock(block, seatsByBlock[block.blockKey] ?? [], interactionMode, activeKeys.includes(block.blockKey), startBlockDrag, startBlockRotate, startBlockResize, startSeatDrag, onSeatClick, toolMode, (b) => onBlockSelect?.([b.blockKey])))}
```

- [ ] **Step 7: Update renderBlock signature**

Change parameters:

```ts
  onSeatPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => void,
  onSeatClick?: (seat: SeatCraftSeat) => void,
  toolMode: SeatCanvasToolMode = 'pointer',
```

- [ ] **Step 8: Wire seat pointer down**

Inside the seat `<g onPointerDown={...}>`, add the `seatMove` branch:

```tsx
              if (toolMode === 'seatMove') {
                onSeatPointerDown(event, block, seat)
                return
              }
```

Place it before the `eraser` branch.

- [ ] **Step 9: Update cursor class**

Change seat group className to:

```tsx
className={mode === 'design' ? (toolMode === 'seatMove' ? 'cursor-move' : 'cursor-pointer') : selectableSeat ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
```

- [ ] **Step 10: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: may still fail until Task 7 updates `SeatLayoutDesigner.tsx`.

## Task 7: 前端设计器更新 overrides

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Import icon and tool mode type**

Change imports:

```ts
import { Grid3X3, LayoutGrid, MousePointer2, Move, RotateCcw, Users, EyeOff } from 'lucide-react'
import { makeBlockKey, makeDefaultStage, type SeatBlockType, type SeatCanvasToolMode, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'
```

- [ ] **Step 2: Change tool mode state type**

Replace:

```ts
const [toolMode, setToolMode] = useState<'pointer' | 'eraser'>('pointer')
```

with:

```ts
const [toolMode, setToolMode] = useState<SeatCanvasToolMode>('pointer')
```

- [ ] **Step 3: Add toolbar button**

Add after pointer button:

```tsx
<button onClick={() => setToolMode('seatMove')} className={`rounded-md p-1.5 transition-colors ${toolMode === 'seatMove' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`} title="移动单座"><Move className="h-4 w-4" /></button>
```

- [ ] **Step 4: Add helper to update free moved seat override**

Add before `return (`:

```ts
  const moveSeat = (blockKey: string, rowNo: number, seatNo: number, x: number, y: number, baseX: number, baseY: number) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block || block.blockType === 'standingBlock') return
    const existingOverrides = block.overrides ?? []
    const overrideIndex = existingOverrides.findIndex(override => override.rowNo === rowNo && override.seatNo === seatNo)
    const dx = x - baseX
    const dy = y - baseY
    const nextOverrides = [...existingOverrides]
    if (overrideIndex >= 0) {
      const current = nextOverrides[overrideIndex]
      if (current.status === 'hidden' || current.status === 'deleted') return
      nextOverrides[overrideIndex] = { ...current, blockKey, rowNo, seatNo, status: 'visible', dx, dy }
    } else {
      nextOverrides.push({ blockKey, rowNo, seatNo, status: 'visible', dx, dy })
    }
    updateBlock(blockKey, { overrides: nextOverrides })
  }
```

- [ ] **Step 5: Pass `onSeatMove`**

Add prop to `SeatCanvas`:

```tsx
onSeatMove={moveSeat}
```

- [ ] **Step 6: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected:

```text
tsc --noEmit
```

with exit code 0.

## Task 8: Focused verification

**Files:**
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`
- Test: frontend typecheck

- [ ] **Step 1: Run Java focused tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest,SeatBlockGeometryServiceTest"
```

Expected:

```text
Failures: 0, Errors: 0
BUILD SUCCESS
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Expected:

```text
tsc --noEmit
```

with exit code 0.

- [ ] **Step 3: Review limited diff**

Run:

```powershell
git diff -- docs/superpowers/specs/2026-05-24-seatcraft-single-seat-free-move-design.md docs/superpowers/plans/2026-05-24-seatcraft-single-seat-free-move.md frontend/src/components/seatcraft/types.ts frontend/src/components/seatcraft/block-layout.ts frontend/src/components/seatcraft/SeatCanvas.tsx frontend/src/components/seatcraft/SeatLayoutDesigner.tsx java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java
```

Expected: frontend changes for single-seat move, Java tests, and no unrelated files.

## Self-Review

- Spec coverage: covers tool mode, base coordinates, drag behavior, override updates, backend persistence/readback/generation tests, and verification.
- Placeholder scan: no unfinished placeholder markers remain.
- Type consistency: uses `SeatCanvasToolMode`, `SeatCraftSeat.baseX/baseY`, `SeatCanvasProps.onSeatMove`, `SeatOverrideDraft.dx/dy`, and existing backend method names consistently.
