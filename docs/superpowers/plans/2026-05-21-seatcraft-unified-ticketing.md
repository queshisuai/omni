# SeatCraft 统一票档与选座实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让主业务前端统一复用 `seatcraft/` 的座位图体验，完成票档创建、C 端选座自动聚焦、导航高亮和返回刷新等体验修正。

**Architecture:** 先把根目录 `seatcraft` 的核心画布和控制能力迁入主前端，外层只做数据适配与业务壳。B 端票档创建、C 端选座、商户活动管理分别走各自的页面流程，但共享同一套座位图组件和布局转换逻辑。后端优先不改结构，只在现有 `SeatCraftLayoutVO`、`SeatMapResponse`、`createAdminTicketType()` 和 `createOrderWithSeats()` 能力上做最小前端适配；若 block/section 语义不够，再补最小 DTO。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, `react-zoom-pan-pinch`, Framer Motion, Lucide React, 现有 Spring Cloud 后端接口。

---

### Task 1: 建立 SeatCraft 统一适配层

**Files:**
- Create: `frontend/src/components/seatcraft-unified/types.ts`
- Create: `frontend/src/components/seatcraft-unified/adapters.ts`
- Create: `frontend/src/components/seatcraft-unified/SeatCraftCanvas.tsx`
- Create: `frontend/src/components/seatcraft-unified/SeatCraftControls.tsx`
- Create: `frontend/src/components/seatcraft-unified/SeatCraftSelector.tsx`
- Create: `frontend/src/components/seatcraft-unified/SeatCraftTicketEditor.tsx`
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx`
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
- Modify: `frontend/src/components/seatcraft/SeatSelectionMap.tsx`

- [ ] **Step 1: 对齐类型定义**

把根目录 `seatcraft/src/components/SeatMap/types.ts` 里的 `SectionData` / `SeatData` 概念映射到主前端可用的统一类型，补齐 `block`、`ticketGroup`、`zoomTarget`、`selectionMode` 等字段。保留现有后端 `SeatCraftLayoutVO`、`SeatCraftSectionVO`、`SeatMapResponse` 的字段，不改后端 DTO。

- [ ] **Step 2: 写适配函数**

在 `adapters.ts` 里实现下面四个转换函数：

```ts
export function toUnifiedSeatCraftLayout(layout: SeatCraftLayoutVO): UnifiedSeatCraftLayout
export function toSeatCraftLayoutDraft(layout: SeatCraftLayoutVO): SeatCraftLayoutDraft
export function toSeatCraftSelectionModel(response: SeatMapResponse): UnifiedSeatCraftSelectionModel
export function buildZoomTargetFromTicketGroup(layout: SeatCraftLayoutVO, ticketTypeId: number): ZoomTarget | null
```

其中 `buildZoomTargetFromTicketGroup()` 必须返回该票档绑定分区的联合 bbox，供后续自动聚焦使用。

- [ ] **Step 3: 复用画布核心实现**

把根目录 `seatcraft/src/components/SeatMap/SeatMap.tsx` 的画布渲染、缩放平移、设计/选座模式能力迁入 `SeatCraftCanvas.tsx`。主前端只保留一层薄封装，避免双份逻辑继续分叉。

- [ ] **Step 4: 复用控制面板语义**

把根目录 `seatcraft/src/components/SeatMap/Controls.tsx` 的模式切换、图例、分区属性编辑入口迁入 `SeatCraftControls.tsx`，并增加“票档绑定模式”入口，以支持票档创建流程。

- [ ] **Step 5: 运行类型检查**

Run: `cd frontend && pnpm typecheck`

Expected: 通过；如果适配层把 `SeatCraftLayoutVO` / `SeatMapResponse` 字段写错，类型检查会先报错。

---

### Task 2: 把场次管理票档创建改成 SeatCraft 编辑器

**Files:**
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/seatcraft/types.ts`

- [ ] **Step 1: 先写会失败的交互测试思路**

在 `frontend/src/app/console/sessions/page.tsx` 中，把现有 `openTicketForm(session)` 改成 SeatCraft 票档编辑器入口后，保留原来的 `ticketDrafts` / `selectedLayoutSectionIds` 只是作为状态源。验收点是：页面不再渲染纯 checkbox 票档表单，而是渲染 SeatCraft 画布和右侧票档属性面板。

- [ ] **Step 2: 改造票档状态流**

把 `ticketDrafts`、`selectedLayoutSectionIds`、`ticketName`、`ticketPrice`、`ticketMessage` 迁入新的 `SeatCraftTicketEditor`。这个编辑器必须接收：

```ts
layout: SeatCraftLayoutVO
session: SessionAdminVO
ticketDrafts: SeatCraftSectionVO[]
onCreateTicketType: (payload) => Promise<void>
```

票档名称、价格、颜色、库存都在编辑器右侧完成，画布上点选分区后直接绑定。

- [ ] **Step 3: 保留后端接口不变**

`frontend/src/lib/api.ts` 里保持 `createAdminTicketType()` 的调用方式不变，只在调用前把 SeatCraft 选择结果整理成：

```ts
{
  userId,
  sessionId,
  name,
  price,
  totalStock,
  layoutSectionIds,
}
```

如果 SeatCraft 里有 block 但后端只接受 section，先在前端适配层把 block 展开为 section id 列表。

- [ ] **Step 4: 接入创建后的刷新逻辑**

保存成功后调用 `loadSessions(page)` 并重新拉取 `getSessionTicketDrafts(session.id, userId)`，确保同一个 session 下已绑定的票档在画布上不可重复选择。

- [ ] **Step 5: 覆盖人工验收点**

手动打开 `http://localhost:3000/console/sessions`，确认：

1. 点击“票档”后出现 SeatCraft 编辑器。
2. 选择分区后，右侧显示票档属性而不是旧卡片表单。
3. 保存后页面刷新，票档绑定状态保留。

---

### Task 3: 把 C 端选座改成 SeatCraft 选座并支持自动聚焦

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/components/SeatMap.tsx`
- Modify: `frontend/src/components/seatcraft/SeatSelectionMap.tsx`
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 把旧选座入口收敛到统一组件**

`activity/[id]/page.tsx` 里只保留一套选座入口，直接使用 `SeatCraftSelector`。旧的 `SeatMap` 作为兼容层，不再是默认渲染。

- [ ] **Step 2: 把票档选择和座位图聚焦绑定起来**

当用户切换 `selectedTicket` 时，调用适配层：

```ts
const zoomTarget = buildZoomTargetFromTicketGroup(detail.layout, selectedTicket.id)
```

若返回非空，则传给 `SeatCraftSelector` 的 `focusTarget`，由组件执行 `scaleTo()` + `centerView()`。

- [ ] **Step 3: 限制可选座位范围**

`SeatCraftSelector` 只允许点击当前票档对应的可售座位。状态判定仍基于 `getSeatMap(sessionId, ticketTypeId)` 返回的 `SessionSeatVO.status`、`ticketTypeId`、`layoutSectionId`。

- [ ] **Step 4: 去掉旧点阵样式作为默认路径**

`frontend/src/components/SeatMap.tsx` 和 `frontend/src/components/seatcraft/SeatSelectionMap.tsx` 只保留兼容，不再在活动详情页的默认路径上直接渲染。新默认路径必须由统一 SeatCraft 选座器接管。

- [ ] **Step 5: 运行手工冒烟**

确认以下流程：

1. 打开活动详情页。
2. 选择场次。
3. 选择票档。
4. 画布自动拉近到对应票档区域。
5. 只可点选该票档下可售座位。
6. 创建订单成功后继续走现有支付宝二维码支付。

---

### Task 4: 修复导航高亮和返回刷新

**Files:**
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/tours/page.tsx`
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 修复导航 active 计算**

把当前 `pathname === item.href || pathname.startsWith(item.href)` 改成“最长前缀优先 + 精确命中优先”。`/console/tours/new` 只能激活“创建演出”，不能同时激活“我的演出”。

- [ ] **Step 2: 给详情页加返回刷新**

在活动详情页、订单页、场次页、演出列表页分别监听 `pageshow` 和 `visibilitychange`。如果用户从详情页返回列表页，触发现有 `loadData()` 或 `loadSessions()` 重新拉取数据。

- [ ] **Step 3: 给返回按钮补语义**

从活动详情返回列表页时，不要只依赖浏览器历史缓存；显式在返回后刷新当前列表数据，避免用户看到旧状态。

- [ ] **Step 4: 验证导航和刷新**

手动检查：

1. `/console/tours` 只高亮“我的演出”。
2. `/console/tours/new` 只高亮“创建演出”。
3. 从活动详情页返回后，列表或订单数据会重新加载。

---

### Task 5: 收敛商户活动管理和 admin 下架活动语义

**Files:**
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/tours/page.tsx`
- Modify: `frontend/src/app/console/tours/new/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 区分 admin 和 organizer 的页面标题**

`activities/page.tsx` 保留 admin 的“平台演出管理”与 organizer 的“我的演出管理”区分；`tours/page.tsx` 保留“我的演出”；`tours/new/page.tsx` 保留“创建演出”。

- [ ] **Step 2: 收敛下架活动文案**

`deactivateActivity()` 的确认弹窗文案改成明确的“下架并退款”流程说明，避免用户以为只是隐藏活动。

- [ ] **Step 3: 控制 organizer 可见操作**

若 organizer 侧不允许执行平台级下架，则隐藏或禁用对应按钮；若允许，则沿用 admin 同样的确认和退款摘要。

- [ ] **Step 4: 验证活动 CRUD 入口**

检查 organizer 在后台只看到自己的活动、创建演出和相关场地申请入口，不会误看到 admin 专用的全量审核入口。

---

### Task 6: 统一验证并收尾提交

**Files:**
- Modify: 以上任务涉及的全部文件
- Test: `frontend` 类型检查、微服务边界脚本

- [ ] **Step 1: 运行前端类型检查**

Run: `cd frontend && pnpm typecheck`

Expected: 通过。

- [ ] **Step 2: 运行微服务边界验证**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: 通过，且没有恢复跨服务 Mapper、跨库 join 或违背 `prod-split` 的配置。

- [ ] **Step 3: 运行 SeatCraft 相关人工冒烟**

至少检查：

1. `http://localhost:3000/console/sessions`
2. `http://localhost:3000/activity/{id}`
3. `http://localhost:3000/console/activities`
4. `http://localhost:3000/console/tours/new`

确认票档编辑、选座聚焦、导航高亮和返回刷新都符合设计。

- [ ] **Step 4: 提交代码**

```bash
git add frontend/src/components/seatcraft-unified frontend/src/components/seatcraft frontend/src/app/console frontend/src/app/activity frontend/src/lib/api.ts frontend/src/types/api.ts
git commit -m "feat: unify SeatCraft ticketing and selection"
```
