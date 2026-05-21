# SeatCraft Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除现有 SeatCraft 设计器和外部工具目录，重建座位生成、设计器、票档绑定和 C 端选座体验，同时保持后端业务逻辑不变。

**Architecture:** 前端以新的 `seatcraft` 纯函数生成层为核心，设计器、票档编辑器、C 端选座共用同一套座位生成逻辑。后端 API 与保存格式尽量不改，继续使用现有 SeatCraft layout API 和 block layout 数据。

**Tech Stack:** Next.js 16 + React 19 + TypeScript；Java ticket 现有 SeatCraft layout API；PowerShell；Maven；pnpm typecheck。

---

## 文件结构

- Delete: `seatcraft/`
  - 删除外部 SeatCraft 工具目录，避免继续污染主项目。
- Delete: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
  - 删除旧设计器实现后重建同名组件，保持调用方 import 稳定。
- Delete: `frontend/src/components/seatcraft/SeatCanvas.tsx`
  - 删除旧画布实现后重建同名组件。
- Delete: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`
  - 删除旧控制栏实现后重建为新工具箱/属性面板。
- Modify: `frontend/src/components/seatcraft/types.ts`
  - 去掉旧 section 编辑语义，保留 API 兼容字段和新 block 类型。
- Modify: `frontend/src/components/seatcraft/block-layout.ts`
  - 重建座位生成、布局 payload、一键排版纯函数。
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts`
  - 覆盖方阵、剧场扇形、站区、一键排版。
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftSelector.tsx`
  - 改为新生成器渲染 C 端选座。
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftTicketEditor.tsx`
  - 改为按 block 绑定票档。
- Modify: `frontend/src/components/seatcraft-unified/adapters.ts`
  - 适配新 block layout 到 selection/ticket 模型。
- Modify: `frontend/src/app/console/venue/page.tsx`
- Modify: `frontend/src/app/console/venue/[id]/seats/page.tsx`
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/console/tours/new/page.tsx`
  - 继续调用 `SeatLayoutDesigner`，无需旧 section 创建入口。

---

### Task 1: 删除外部 SeatCraft 工具目录

**Files:**
- Delete: `seatcraft/`

- [ ] **Step 1: 确认外部目录存在**

Run: `Test-Path -LiteralPath "seatcraft"`

Expected: `True` 或目录已不存在。

- [ ] **Step 2: 删除目录**

Run: `Remove-Item -LiteralPath "seatcraft" -Recurse -Force`

Expected: 命令退出 0。

- [ ] **Step 3: 确认删除完成**

Run: `Test-Path -LiteralPath "seatcraft"`

Expected: `False`。

---

### Task 2: 重建座位生成纯函数

**Files:**
- Modify: `frontend/src/components/seatcraft/block-layout.ts`
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts`

- [ ] **Step 1: 写失败测试**

在 `block-layout.test.ts` 覆盖这些行为：

```ts
test('grid block generates deterministic row and column seats', () => {
  const seats = buildSeatsForBlock(gridBlock())
  assert.equal(seats.length, 6)
  assert.deepEqual(pick(seats[0], ['id', 'row', 'col', 'x', 'y', 'label']), { id: 'block-a-1-1', row: 0, col: 0, x: 100, y: 200, label: '1排1座' })
})

test('theater arc block expands rows from center', () => {
  const block: SeatBlockDraft = { ...gridBlock(), blockType: 'arcBlock', x: 500, y: 300, rows: 2, seatsPerRow: 3, innerRadius: 100, rowSpacing: 40, arcStartAngle: -60, arcEndAngle: 60 }
  const seats = buildSeatsForBlock(block)
  assert.equal(seats.length, 6)
  assert.equal(seats[1].x, 500)
  assert.equal(seats[1].y, 400)
  assert.ok(seats[4].y > seats[1].y)
})

test('standing block generates no individual seats', () => {
  const block: SeatBlockDraft = { ...gridBlock(), blockType: 'standingBlock', capacity: 500, width: 180, height: 90 }
  assert.deepEqual(buildSeatsForBlock(block), [])
})

test('auto arrange layout only runs when called explicitly', () => {
  const layout: SeatCraftLayoutDraft = { id: 9, name: '默认座位图', templateType: 'concert', stage: { title: '舞台', x: 500, y: 60 }, canvasWidth: 1000, canvasHeight: 800, sections: [], blocks: [gridBlock(), { ...gridBlock(), id: '2', blockKey: 'block-b', name: 'B 区', x: 123, y: 456 }], ticketGroups: [] }
  const arranged = autoArrangeSeatLayout(layout)
  assert.deepEqual(arranged.blocks?.map(block => pick(block, ['x', 'y'])), [{ x: 120, y: 180 }, { x: 420, y: 180 }])
})
```

- [ ] **Step 2: 用 typecheck 验证失败**

Run: `pnpm typecheck`

Expected: `autoArrangeSeatLayout` 缺失或相关类型失败。

- [ ] **Step 3: 实现纯函数**

在 `block-layout.ts` 实现：

```ts
export function buildSeatsForBlock(block: SeatBlockDraft, selectedSeatIds: string[] = []): SeatCraftSeat[]
export function autoArrangeSeatLayout(layout: SeatCraftLayoutDraft): SeatCraftLayoutDraft
export function toSeatCraftLayoutPayload(layout: SeatCraftLayoutDraft): SeatCraftLayoutPayload
```

要求：

- 方阵坐标：`x + (seatNo - 1) * seatSpacing`、`y + (rowNo - 1) * rowSpacing`。
- 剧场扇形坐标：`x + radius * sin(angle)`、`y + radius * cos(angle)`。
- 站区返回空座位数组。
- `autoArrangeSeatLayout()` 只在被调用时调整 `blocks[].x/y`。

- [ ] **Step 4: 验证通过**

Run: `pnpm typecheck`

Expected: `tsc --noEmit` 无错误。

---

### Task 3: 重建设计器 UI

**Files:**
- Replace: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
- Replace: `frontend/src/components/seatcraft/SeatCanvas.tsx`
- Replace: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`
- Modify: `frontend/src/components/seatcraft/types.ts`

- [ ] **Step 1: 重建类型**

`types.ts` 保留：

```ts
export type SeatBlockType = 'gridBlock' | 'arcBlock' | 'standingBlock'
export interface SeatBlockDraft { id: string; blockKey: string; name: string; blockType: SeatBlockType; ticketGroupKey: string; x: number; y: number; rotation: number; scale: number; rows?: number | null; cols?: number | null; seatsPerRow?: number | null; rowSpacing?: number | null; seatSpacing?: number | null; innerRadius?: number | null; arcStartAngle?: number | null; arcEndAngle?: number | null; width?: number | null; height?: number | null; capacity?: number | null; color: string; sort: number; overrides?: SeatOverrideDraft[] }
export interface SeatCraftLayoutDraft { id?: number | null; venueId?: number | null; activityId?: number | null; sessionId?: number | null; name: string; templateType: 'concert' | 'cinema' | 'custom'; stage: SeatCraftStage; canvasWidth: number; canvasHeight: number; sections: SeatCraftSection[]; blocks?: SeatBlockDraft[]; overrides?: SeatOverrideDraft[]; ticketGroups?: TicketGroupDraft[] }
```

- [ ] **Step 2: 重建 `SeatCanvas`**

实现 SVG 画布：

- 渲染舞台。
- 渲染方阵/剧场扇形座位点。
- 渲染站区矩形。
- 设计模式支持块点击、块拖拽、舞台拖拽。
- 选座模式支持座位点击。

- [ ] **Step 3: 重建 `SeatLayoutControls`**

实现左工具箱和右属性能力：

- 创建方阵、剧场扇形、站区。
- 图层列表选中块。
- 一键排版、复制、镜像、删除。
- 当前块属性编辑。

- [ ] **Step 4: 重建 `SeatLayoutDesigner`**

实现：

- 中间画布 + 右侧控制栏。
- 新增块固定放到画布中心附近。
- 不自动排版、不吸附。
- 点击“一键排版”才调用 `autoArrangeSeatLayout()`。

- [ ] **Step 5: 验证类型**

Run: `pnpm typecheck`

Expected: `tsc --noEmit` 无错误。

---

### Task 4: 重建 C 端选座和票档绑定

**Files:**
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftSelector.tsx`
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftTicketEditor.tsx`
- Modify: `frontend/src/components/seatcraft-unified/adapters.ts`

- [ ] **Step 1: 选座只读新 block layout**

`SeatCraftSelector` 使用 `buildSeatsForBlock()` 渲染座位。

- [ ] **Step 2: 票档绑定改为 block 绑定**

`SeatCraftTicketEditor` 展示 `layout.blockLayout.blocks` 或 `layout.blocks`，选中 block key 后绑定票档。

- [ ] **Step 3: 票档聚焦按 block 计算 bounds**

`buildZoomTargetFromTicketGroup()` 根据 block 坐标和生成座位坐标计算聚焦矩形。

要求：用户选择票档或票位后，C 端画布必须平滑拉近到该票档绑定的方阵、剧场扇形或站区 bounds，效果类似自动拉近镜头。

- [ ] **Step 4: 旧 section-only layout 提示重建**

如果 layout 没有 blocks，但有 sections，前端提示：`旧座位图需重建，请进入 SeatCraft 设计器重新创建座位图。`

- [ ] **Step 5: 验证类型**

Run: `pnpm typecheck`

Expected: `tsc --noEmit` 无错误。

---

### Task 5: 更新调用页面并移除旧污染

**Files:**
- Modify: `frontend/src/app/console/venue/page.tsx`
- Modify: `frontend/src/app/console/venue/[id]/seats/page.tsx`
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/console/tours/new/page.tsx`
- Search: all `frontend/src/**/*.tsx`

- [ ] **Step 1: 确认所有设计入口仍使用新 `SeatLayoutDesigner`**

Run: 搜索 `SeatLayoutDesigner`。

Expected: 只在场馆、场次、tour 创建等新设计入口引用。

- [ ] **Step 2: 删除旧 section 创建提示**

页面文案不得出现“旧分区”、“旧点阵”、“旧座位图编辑”。

- [ ] **Step 3: 旧数据提示统一**

旧 layout 无 blocks 时统一显示重建提示。

- [ ] **Step 4: 验证类型**

Run: `pnpm typecheck`

Expected: `tsc --noEmit` 无错误。

---

### Task 6: 最终验证

**Files:**
- No code changes.

- [ ] **Step 1: 前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

- [ ] **Step 2: ticket 后端测试**

Run: `mvn test -pl java-ticket -am` in `java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: 差异检查**

Run: `git diff --check`

Expected: 仅允许 LF/CRLF warning，不允许 whitespace error。

- [ ] **Step 5: 工作区摘要**

Run: `git status --short` and `git diff --stat`

Expected: 只包含本次 SeatCraft 重建和之前已知未提交变更。

---

## 自检

- 覆盖删除外部 `seatcraft/`。
- 覆盖删除旧设计器和旧 section 创建入口。
- 覆盖方阵、剧场扇形、站区三种生成规则。
- 覆盖一键排版作为显式操作。
- 覆盖 C 端选座和 B 端票档绑定继续使用同一生成器。
- 不新增跨服务访问，不修改订单/支付/退款业务逻辑。
