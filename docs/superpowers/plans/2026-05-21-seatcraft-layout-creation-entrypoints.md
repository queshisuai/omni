# SeatCraft Layout Creation Entrypoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有活动/场次补齐 SeatCraft 座位图创建入口，并把场馆管理的“配置区域”从旧点阵入口切到 SeatCraft 默认座位图编辑器。

**Architecture:** 前端优先复用现有 SeatCraft API：`getVenueDefaultLayout/updateVenueDefaultLayout`、`getActivitySeatLayout/updateActivitySeatLayout`、`getSessionSeatLayout/updateSessionSeatLayout`。场次票档页缺 SeatCraft 时提供“去创建座位图”按钮，智能跳转到场次 SeatCraft 编辑页；场馆页按钮进入 SeatCraft 默认图编辑，不再进入旧点阵区域页。

**Tech Stack:** Next.js 16 + React 19 + TypeScript；现有 Java ticket SeatCraft layout API；pnpm typecheck。

---

## 文件结构

- Modify: `frontend/src/app/console/venue/page.tsx`
  - 将“配置区域”按钮改为“配置 SeatCraft”，调用现有编辑表单。
- Modify: `frontend/src/app/console/venue/[id]/seats/page.tsx`
  - 用 SeatCraft 场馆默认座位图编辑器替代旧点阵区域维护页面。
- Modify: `frontend/src/app/console/sessions/page.tsx`
  - 缺 SeatCraft layout 时显示“去创建座位图”按钮。
- Create: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
  - 场次 SeatCraft 座位图编辑器；优先加载场次 layout，其次提示从活动/场馆复制。
- Modify: `frontend/src/lib/api.ts`
  - 如需要，补充按 session 获取详情或复用已有 list API。

---

### Task 1: 场馆 SeatCraft 配置入口

**Files:**
- Modify: `frontend/src/app/console/venue/page.tsx`

- [ ] **Step 1: 改按钮文案和目标**

把场馆列表中的：

```tsx
<Link href={`/console/venue/${v.id}/seats`}>配置区域</Link>
```

改为：

```tsx
<Link href={`/console/venue/${v.id}/seats`}>配置 SeatCraft</Link>
```

- [ ] **Step 2: 明确编辑按钮仍可编辑基本信息 + 默认 SeatCraft**

保留 `openEdit(v)`，因为当前编辑表单已经能加载并保存 `VenueDefaultLayout`。

- [ ] **Step 3: 跑类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 2: 替换旧点阵场馆座位模板页

**Files:**
- Modify: `frontend/src/app/console/venue/[id]/seats/page.tsx`

- [ ] **Step 1: 用 SeatCraft 编辑器替换旧点阵 UI**

页面加载 `getVenueDefaultLayout(venueId)`。

如果没有 layout，则创建默认 `SeatCraftLayoutDraft`。

使用 `SeatLayoutDesigner` 编辑。

保存调用：

```ts
updateVenueDefaultLayout(venueId, {
  userId: user.userId,
  layout: toSeatCraftLayoutPayload({ ...layoutDraft, id: layoutDraft.id ?? 0 }),
})
```

- [ ] **Step 2: 移除旧区域/座位表单引用**

移除这些 API 引用：

```ts
createVenueArea, createVenueSeat, deleteVenueSeat, listVenueAreas, listVenueSeats, updateVenueSeat
```

- [ ] **Step 3: 保留权限校验**

普通非 admin 仍显示：`仅管理员可维护场馆 SeatCraft 座位图`。

- [ ] **Step 4: 跑类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 3: 场次缺 SeatCraft 时给创建按钮

**Files:**
- Modify: `frontend/src/app/console/sessions/page.tsx`

- [ ] **Step 1: 在缺 layout 提示处增加按钮**

当前文案：

```tsx
当前场次尚未配置 SeatCraft 座位图，请先配置座位图后再创建票档。
```

改为带按钮：

```tsx
<Link href={`/console/sessions/${ticketFormSession.id}/seat-layout`} className="mt-4 inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">
  去创建座位图
</Link>
```

- [ ] **Step 2: 跑类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 4: 新增场次 SeatCraft 编辑页

**Files:**
- Create: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`

- [ ] **Step 1: 实现加载策略**

加载当前用户和 `sessionId`。

优先调用 `getSessionSeatLayout(sessionId, userId)`。

如果返回 null 或失败，创建默认 SeatCraft draft：

```ts
function createDefaultLayout(name: string): SeatCraftLayoutDraft {
  return {
    name,
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 960,
    canvasHeight: 720,
    sections: [],
    blocks: [],
    overrides: [],
    ticketGroups: [],
  }
}
```

- [ ] **Step 2: 实现保存**

保存调用：

```ts
updateSessionSeatLayout(sessionId, {
  userId: user.userId,
  layout: toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? 0 }),
})
```

- [ ] **Step 3: 保存后提供返回票档管理按钮**

返回链接：

```tsx
<Link href="/console/sessions">返回场次/票档</Link>
```

- [ ] **Step 4: 跑类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 5: 验证

**Files:**
- No code changes.

- [ ] **Step 1: 前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

- [ ] **Step 2: ticket 测试**

Run: `mvn test -pl java-ticket -am` in `java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 提醒用户重启/刷新前端**

输出：

```text
需要你刷新 frontend；如果后端 SeatCraft API 已经在运行，无需额外重启后端。本次我不重启服务。
```

---

## 自检

- 覆盖用户要求：现有活动/场次缺 SeatCraft 时有“去创建座位图”按钮；场馆管理不再引导到旧点阵“配置区域”。
- 遵守边界：只使用 ticket 服务已有 SeatCraft layout API，不新增跨服务访问。
- 不重启服务：计划只运行测试和类型检查，不操作进程。
