# SeatCraft Polygon Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加 `polygonBlock`，让 SeatCraft 可以创建、编辑、保存并由前后端一致地自动填充多边形内座位。

**Architecture:** 数据层在 `seat_block` 增加 `polygon_points JSONB` 并放开 `chk_seat_block_type`。后端 `SeatBlockGeometryService` 是库存和场次座位生成的权威来源，前端 `block-layout.ts` 使用相同的局部坐标网格扫描规则做预览。画布负责创建、展示和拖拽顶点，顶点拖拽复用 Undo/Redo 的 `mergeKey`。

**Tech Stack:** Java Spring Boot、MyBatis-Plus、PostgreSQL JSONB、Next.js 16、React 19、TypeScript、Node test。

---

## File Structure

- Modify: `frontend/src/components/seatcraft/types.ts` - 增加 `polygonBlock` 和 `polygonPoints` 类型。
- Modify: `frontend/src/types/api.ts` - API 类型增加 `polygonBlock` 和 `polygonPoints`。
- Modify: `frontend/src/components/seatcraft/block-layout.ts` - 前端 polygon 自动填充算法。
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts` - 前端 polygon 几何测试。
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx` - 添加 polygonBlock、默认点、顶点更新回调。
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx` - 绘制多边形轮廓、顶点控制点、顶点拖拽。
- Modify: `frontend/src/components/seatcraft/SeatLayoutControls.tsx` - polygon 属性面板。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatBlock.java` - `polygonPoints` 字段。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java` - `BlockRequest.polygonPoints`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java` - 保存、读取、校验 polygon points。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java` - 后端 polygon 自动填充。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java` - 后端 polygon 几何测试。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java` - 持久化/读取测试。
- Add: `sql/migrations/shared/20260524_seatcraft_polygon_block.sql` - shared 迁移。
- Add: `sql/production-split/ticket/20260524_seatcraft_polygon_block.sql` - production-split 迁移。
- Modify: `sql/production-split/manifest.json` - 注册迁移。
- Modify: `scripts/check-production-split-sql.ps1` - 如脚本要求，登记 `polygon_points`。

## Task 1: Frontend Polygon Geometry RED

**Files:**
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts`

- [ ] **Step 1: Add polygon helper**

Add after `gridBlock()`:

```ts
function polygonBlock(overrides: SeatOverrideDraft[] = []): SeatBlockDraft {
  return {
    ...gridBlock(overrides),
    blockKey: 'poly-a',
    name: '异形区',
    blockType: 'polygonBlock',
    x: 10,
    y: 20,
    rows: null,
    cols: null,
    seatsPerRow: null,
    rowSpacing: 10,
    seatSpacing: 10,
    polygonPoints: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ],
  }
}
```

- [ ] **Step 2: Add failing tests**

Add after the standing block test:

```ts
test('polygon block fills seats inside polygon bounds', () => {
  const seats = buildSeatsForBlock(polygonBlock())

  assert.equal(seats.length, 9)
  assert.deepEqual(pick(seats[0], ['id', 'row', 'col', 'x', 'y']), { id: 'poly-a-1-1', row: 0, col: 0, x: 10, y: 20 })
  assert.deepEqual(pick(seats[8], ['id', 'row', 'col', 'x', 'y']), { id: 'poly-a-3-3', row: 2, col: 2, x: 30, y: 40 })
})

test('polygon block excludes candidates outside polygon', () => {
  const block: SeatBlockDraft = {
    ...polygonBlock(),
    polygonPoints: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 20 },
    ],
  }

  const seats = buildSeatsForBlock(block)

  assert.equal(seats.length, 6)
  assert.deepEqual(seats.map(seat => seat.id), ['poly-a-1-1', 'poly-a-1-2', 'poly-a-1-3', 'poly-a-2-1', 'poly-a-2-2', 'poly-a-3-1'])
})

test('polygon block applies hidden and moved overrides', () => {
  const seats = buildSeatsForBlock(polygonBlock([
    { blockKey: 'poly-a', rowNo: 1, seatNo: 1, status: 'hidden', dx: 0, dy: 0 },
    { blockKey: 'poly-a', rowNo: 1, seatNo: 2, status: 'visible', dx: 5, dy: 7, customLabel: 'P02' },
  ]))

  assert.equal(seats.length, 8)
  assert.deepEqual(pick(seats[0], ['id', 'x', 'y', 'label']), { id: 'poly-a-1-2', x: 25, y: 27, label: 'P02' })
})
```

- [ ] **Step 3: Verify RED**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
```

Expected: FAIL because `polygonBlock` is not supported yet.

## Task 2: Frontend Polygon Geometry GREEN

**Files:**
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/seatcraft/block-layout.ts`
- Test: `frontend/src/components/seatcraft/block-layout.test.ts`

- [ ] **Step 1: Extend SeatCraft types**

In `frontend/src/components/seatcraft/types.ts`, update `SeatBlockType`:

```ts
export type SeatBlockType = 'gridBlock' | 'arcBlock' | 'standingBlock' | 'polygonBlock'
```

Add:

```ts
export interface SeatCraftPoint {
  x: number
  y: number
}
```

Add to `SeatBlockDraft`:

```ts
polygonPoints?: SeatCraftPoint[] | null
```

- [ ] **Step 2: Extend API types**

In `frontend/src/types/api.ts`, update the `SeatCraftBlockType` union to include `polygonBlock`. Add this field to SeatCraft block response/request types:

```ts
polygonPoints?: Array<{ x: number; y: number }> | null
```

- [ ] **Step 3: Implement polygon generation in `block-layout.ts`**

Add a `polygonBlock` branch before grid fallback:

```ts
if (block.blockType === 'polygonBlock') {
  return buildPolygonSeats(block, overrides, selectedSeatIds, includeExcluded)
}
```

Implement helpers in the same file:

```ts
function buildPolygonSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[], includeExcluded: boolean) {
  const points = block.polygonPoints ?? []
  if (points.length < 3) return []
  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const seatSpacing = positive(block.seatSpacing, DEFAULT_SEAT_SPACING)
  const minX = Math.min(...points.map(point => point.x))
  const maxX = Math.max(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxY = Math.max(...points.map(point => point.y))
  const seats: SeatCraftSeat[] = []
  let rowNo = 1
  for (let y = minY; y <= maxY + 0.000001; y += rowSpacing) {
    let seatNo = 1
    for (let x = minX; x <= maxX + 0.000001; x += seatSpacing) {
      if (!pointInPolygon({ x, y }, points)) continue
      const override = overrides.get(key(rowNo, seatNo))
      const excluded = isExcluded(override)
      if (!excluded || includeExcluded) {
        const world = rotateLocalPoint(block, x, y, points)
        seats.push(buildSeat(block, rowNo, seatNo, world.x, world.y, override, selectedSeatIds, block.rotation || 0, excluded))
      }
      seatNo += 1
    }
    rowNo += 1
  }
  return seats
}
```

Also add `rotateLocalPoint`, `pointInPolygon`, `pointOnSegment`, and `distanceToSegmentSquared` helpers. Use ray casting and treat points on a segment as inside with epsilon `0.000001`.

- [ ] **Step 4: Verify GREEN**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

Expected: tests pass and `tsc --noEmit` passes.

## Task 3: Backend Polygon Geometry RED/GREEN

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatBlock.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java`

- [ ] **Step 1: Add failing tests**

Add tests for `polygonBlockGeneratesSeatsInsideBounds`, `polygonBlockExcludesOutsideCandidates`, `polygonBlockAppliesOverrides`, and `polygonBlockRejectsInvalidPoints`. Use JSON string:

```java
"[{\"x\":0,\"y\":0},{\"x\":20,\"y\":0},{\"x\":20,\"y\":20},{\"x\":0,\"y\":20}]"
```

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatBlockGeometryServiceTest"
```

Expected: FAIL because `SeatBlock` has no `polygonPoints` and polygon generation is not implemented.

- [ ] **Step 2: Add `polygonPoints` to `SeatBlock`**

Add field, getter and setter:

```java
private String polygonPoints;
public String getPolygonPoints() { return polygonPoints; }
public void setPolygonPoints(String polygonPoints) { this.polygonPoints = polygonPoints; }
```

- [ ] **Step 3: Implement backend polygon generation**

In `SeatBlockGeometryService`, change polygon handling to `generatePolygonSeats(block, overrideMap)`. Implement JSON parsing with Jackson `ObjectMapper`, area validation, bounding-box scan, point-in-polygon, segment-boundary check, rotation around local bounding-box center, and existing override application.

Error messages must match spec:

```java
throw new BusinessException(400, "多边形座位块顶点不正确");
throw new BusinessException(400, "多边形座位块至少需要3个顶点");
throw new BusinessException(400, "多边形座位块面积必须大于0");
```

- [ ] **Step 4: Verify GREEN**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatBlockGeometryServiceTest"
```

Expected: test suite passes.

## Task 4: Backend Persistence And SQL

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java`
- Add: `sql/migrations/shared/20260524_seatcraft_polygon_block.sql`
- Add: `sql/production-split/ticket/20260524_seatcraft_polygon_block.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `scripts/check-production-split-sql.ps1` if needed.

- [ ] **Step 1: Add persistence RED test**

In `SeatCraftBlockLayoutServiceTest`, add `replaceLayoutPersistsAndReturnsPolygonPoints`. It should set `BlockRequest.blockType` to `polygonBlock`, set `polygonPoints`, capture inserted `SeatBlock`, and assert returned layout includes the same JSON string.

- [ ] **Step 2: Verify RED**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest"
```

Expected: FAIL because DTO/entity/service do not persist polygon points.

- [ ] **Step 3: Add DTO field and service mapping**

Add `polygonPoints` field/getter/setter to `SeatCraftBlockDtos.BlockRequest`. In `SeatCraftBlockLayoutService.upsertBlocks()` call `block.setPolygonPoints(trim(request.getPolygonPoints()))`. In `toBlockRequest()` call `request.setPolygonPoints(block.getPolygonPoints())`.

- [ ] **Step 4: Add SQL migrations**

Create both SQL files with:

```sql
-- owner: java-ticket
ALTER TABLE seat_block ADD COLUMN IF NOT EXISTS polygon_points JSONB;

ALTER TABLE seat_block DROP CONSTRAINT IF EXISTS chk_seat_block_type;
ALTER TABLE seat_block ADD CONSTRAINT chk_seat_block_type
    CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock', 'polygonBlock'));
```

Add `ticket/20260524_seatcraft_polygon_block.sql` to `sql/production-split/manifest.json` under java-ticket migrations after `ticket/20260523_private_asset.sql`.

- [ ] **Step 5: Verify GREEN**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockLayoutServiceTest,SeatBlockGeometryServiceTest"
```

Expected: tests pass.

## Task 5: Frontend Designer And Canvas

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx`
- Modify: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`

- [ ] **Step 1: Add polygon create button**

In `SeatLayoutDesigner.tsx`, add a toolbar button that calls `addBlock('polygonBlock')`. Extend `createBlock()` so `polygonBlock` returns default four-point `polygonPoints` and null `rows/cols/seatsPerRow/width/height/capacity`.

- [ ] **Step 2: Add vertex update path**

Add `onPolygonPointMove?: (blockKey: string, pointIndex: number, x: number, y: number) => void` to `SeatCanvasProps`. In `SeatLayoutDesigner`, implement update by replacing `polygonPoints[index]` and passing `mergeKey: resize:polygon:${blockKey}:${pointIndex}`.

- [ ] **Step 3: Render polygon outline and handles**

In `SeatCanvas.renderBlock()`, when `block.blockType === 'polygonBlock'`, draw `<polygon>` from `polygonPoints` transformed by block x/y, then draw generated seats. When active, render draggable vertex handles.

- [ ] **Step 4: Update controls**

In `SeatLayoutControls.tsx`, add `polygonBlock` label `多边形区` and show `rowSpacing`、`seatSpacing`、顶点数、预估容量. Do not show `rows`、`cols`、`seatsPerRow`、`capacity` for polygonBlock.

- [ ] **Step 5: Verify frontend**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 6: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run backend tests**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatBlockGeometryServiceTest,SeatCraftBlockLayoutServiceTest"
```

Expected: tests pass.

- [ ] **Step 2: Run frontend tests and typecheck**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 3: Run boundary verifier**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: verifier passes.

- [ ] **Step 4: Review limited diff**

Run from repo root:

```powershell
git diff -- frontend/src/components/seatcraft frontend/src/types/api.ts java/java-ticket/src/main/java/com/omni/ticket/entity/SeatBlock.java java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftBlockLayoutServiceTest.java sql/migrations/shared/20260524_seatcraft_polygon_block.sql sql/production-split/ticket/20260524_seatcraft_polygon_block.sql sql/production-split/manifest.json scripts/check-production-split-sql.ps1 docs/superpowers/specs/2026-05-24-seatcraft-polygon-block-design.md docs/superpowers/plans/2026-05-24-seatcraft-polygon-block.md
```

Expected: diff is limited to polygonBlock work and already-created Undo/Redo support files if still uncommitted.

## Self-Review Notes

- Spec coverage: data model, frontend preview, backend authoritative generation, persistence, SQL, Undo/Redo reuse, tests and boundary verification are covered.
- Placeholder scan: no TBD/TODO placeholders remain; implementation details and commands are explicit.
- Type consistency: `polygonPoints`, `polygonBlock`, `SeatCraftPoint`, and `mergeKey` names match the spec.
