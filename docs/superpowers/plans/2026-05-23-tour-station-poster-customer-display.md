# Tour Station Poster Customer Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 C 端巡演详情页的选中城市站详情卡片中展示城市站海报。

**Architecture:** 只修改 `/tour/[id]` 前端页面，复用已有 `TourDetailVO.stationDetails[].station.poster` 数据。顶部巡演主视觉仍使用巡演主海报；城市站详情卡片内部新增图片区域，图片 fallback 顺序为 `station.poster -> tour.poster -> /background.png`。

**Tech Stack:** Next.js 16、React 19、TypeScript。

---

## Scope Guardrails

- 不修改后端。
- 不修改 B 端巡演、城市站或上传页面。
- 不修改 `frontend/src/components/seatcraft/**`。
- 不修改 `frontend/src/components/seatcraft-unified/**`。
- 不修改座位图 API、座位表交互、SeatCraft 深色 IDE 风格。
- 不改变顶部巡演主视觉图片。
- 不改变城市站按钮列表形态。

## File Structure

- Modify: `frontend/src/app/tour/[id]/page.tsx`
  - 增加 `selectedStationPoster` 计算。
  - 将选中城市站详情卡片改成移动端上下、桌面端左图右信息布局。

---

### Task 1: C 端选中城市站卡片展示海报

**Files:**
- Modify: `frontend/src/app/tour/[id]/page.tsx`

- [ ] **Step 1: 计算选中城市站海报 URL**

在现有派生状态附近加入：

```ts
const selectedStationPoster = selectedStation?.station.poster || detail?.tour.poster || '/background.png'
```

- [ ] **Step 2: 调整选中城市站详情卡片布局**

把 `selectedStation && (...)` 内部的详情卡片从单列文本块改为：

```tsx
{selectedStation && (
  <div className="mt-5 rounded-xl bg-[#fafafa] p-5 text-[14px] text-[#555]">
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="overflow-hidden rounded-xl bg-[#f0f0f0]">
        <img src={selectedStationPoster} alt={`${selectedStation.station.city} ${selectedStation.station.stationName}`} className="h-44 w-full object-cover lg:h-full" />
      </div>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[18px] font-semibold text-[#111]">{selectedStation.station.city}</div>
            <div className="mt-1 text-[13px] text-[#999]">{selectedStation.station.stationName} · {selectedStatusText}</div>
          </div>
          <button
            disabled={!canBuy || hideStationDetail}
            onClick={() => {
              if (canBuy && selectedStation.activity) router.push(`/activity/${selectedStation.activity.id}`)
            }}
            className="rounded-lg px-5 py-2.5 text-[14px] font-medium disabled:cursor-not-allowed disabled:bg-[#e5e5e5] disabled:text-[#999]"
            style={canBuy && !hideStationDetail ? { background: '#ff1268', color: '#fff' } : undefined}
          >
            {actionText}
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">时间</div>
            <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '时间未公布' : formatDateTime(primarySession?.startTime)}</div>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">场馆</div>
            <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : selectedStation.venueName || '未公布'}</div>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">地址</div>
            <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : selectedStation.venueAddress || '未公布'}</div>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">城市</div>
            <div className="mt-1 font-medium text-[#333]">{selectedStation.station.city}</div>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">状态</div>
            <div className="mt-1 font-medium text-[#333]">{selectedStatusText}</div>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="text-[12px] text-[#999]">票价</div>
            <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : formatPrice(selectedStation.priceMin, selectedStation.priceMax)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

- [ ] **Step 4: 限定文件空白检查**

Run:

```powershell
git diff --check -- "docs/superpowers/plans/2026-05-23-tour-station-poster-customer-display.md" "frontend/src/app/tour/[id]/page.tsx"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: 无 trailing whitespace 报错。LF/CRLF warning 可接受。

---

## Self-Review

- Spec coverage: 覆盖 C 端选中城市站海报展示和 fallback 顺序。
- Placeholder scan: 未使用 TBD/TODO/稍后实现等占位描述。
- Type consistency: 使用现有 `StationEntity.poster` 和 `TourEntity.poster`，不新增类型。
- Scope check: 单页面前端展示改动，不包含后端、B 端或 SeatCraft。
