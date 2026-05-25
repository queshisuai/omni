# Tour Station Thumbnail Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 C 端巡演详情页城市站按钮列表中展示每个城市站的小缩略图。

**Architecture:** 只修改 `/tour/[id]` 前端页面，复用已有 `Station.poster` 和 `Tour.poster`。城市站按钮从纯文字 pill 扩展为带 40px 缩略图的横向卡片，保留横向滚动、active 状态和点击切换逻辑。

**Tech Stack:** Next.js 16、React 19、TypeScript。

---

## Scope Guardrails

- 不修改后端。
- 不修改 B 端页面。
- 不修改顶部巡演主视觉。
- 不修改选中城市站详情卡片以外的购票逻辑。
- 不修改 `frontend/src/components/seatcraft/**`。
- 不修改 `frontend/src/components/seatcraft-unified/**`。
- 不修改座位图 API、座位表交互、SeatCraft 深色 IDE 风格。

## File Structure

- Modify: `frontend/src/app/tour/[id]/page.tsx`
  - 城市站按钮列表中为每个站点计算 `stationPoster`。
  - 把按钮从纯文字圆角 pill 改为带缩略图的圆角横向卡片。

---

### Task 1: 城市站按钮增加缩略图

**Files:**
- Modify: `frontend/src/app/tour/[id]/page.tsx`

- [x] **Step 1: 在站点按钮 map 中计算缩略图 URL**

在 `stationDetails.map(item => {` 内部，`active` 后增加：

```ts
const stationPoster = item.station.poster || detail.tour.poster || '/background.png'
```

- [x] **Step 2: 替换按钮内容和样式**

把当前城市按钮替换为：

```tsx
<button
  key={item.station.id}
  aria-pressed={active}
  onClick={() => setSelectedStation(item)}
  className="flex min-w-[190px] items-center gap-3 rounded-2xl border p-2 pr-4 text-left text-[14px] transition"
  style={{
    borderColor: active ? '#ff1268' : '#e5e5e5',
    color: active ? '#ff1268' : '#333',
    background: active ? '#fff0f5' : '#fff',
  }}
>
  <img src={stationPoster} alt={item.station.stationName} className="h-10 w-10 rounded-xl object-cover" />
  <span className="min-w-0">
    <span className="block truncate font-medium">{item.station.city}</span>
    <span className="mt-0.5 block truncate text-[12px] opacity-80">{formatStationStatus(item)}</span>
  </span>
</button>
```

- [x] **Step 3: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

- [x] **Step 4: 限定文件空白检查**

Run:

```powershell
git diff --check -- "docs/superpowers/plans/2026-05-23-tour-station-thumbnail-tabs.md" "frontend/src/app/tour/[id]/page.tsx"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: 无 trailing whitespace 报错。LF/CRLF warning 可接受。

---

## Self-Review

- Spec coverage: 覆盖城市站按钮缩略图、fallback 顺序、active 状态和横向滚动保留。
- Placeholder scan: 未使用 TBD/TODO/稍后实现等占位描述。
- Type consistency: 复用现有 `StationEntity.poster` 和 `TourEntity.poster`。
- Scope check: 单页面前端展示改动，不涉及后端、B 端或 SeatCraft。
