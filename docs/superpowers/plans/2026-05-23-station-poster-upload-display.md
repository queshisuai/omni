# Station Poster Upload Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在新增城市站时支持上传 `station-poster`，并在巡演详情站点卡片展示城市站海报。

**Architecture:** 复用现有 `LocalFileUpload` 和 `uploadTicketAsset`，前端保存站点草稿时把上传得到的公开 URL 写入已有 `Station.poster` 字段。后端 schema、`TourStationService.createStationDraft` 和发布活动时的 station poster fallback 逻辑已存在，无需改后端。

**Tech Stack:** Next.js 16、React 19、TypeScript、现有本地素材上传 API。

---

## Scope Guardrails

- 不修改 `frontend/src/components/seatcraft/**`。
- 不修改 `frontend/src/components/seatcraft-unified/**`。
- 不修改座位图 API、座位表交互、SeatCraft 深色 IDE 风格。
- 不新增城市站编辑页。
- 不修改后端 schema。
- 不修改 `venue-proof` 公开上传策略；场地证明仍不走公开 `/uploads/ticket/**`。
- 不修改 `TourStationService.publishStation(...)`，它已使用 `station.poster` 并 fallback 到 `tour.poster`。

## File Structure

- Modify: `frontend/src/app/console/tours/[id]/stations/new/page.tsx`
  - 增加 `poster` 和 `uploadingPoster` state。
  - 引入 `LocalFileUpload`、`uploadTicketAsset`。
  - 新增城市站时传 `poster: poster.trim() || null`。
  - 上传中禁用保存按钮。
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`
  - 巡演详情站点卡片展示站点海报。
  - 图片来源优先级：`item.station.poster` -> `detail.tour.poster` -> `/background.png`。

---

### Task 1: 新增城市站页面接入 station poster 上传

**Files:**
- Modify: `frontend/src/app/console/tours/[id]/stations/new/page.tsx`

- [ ] **Step 1: 引入上传依赖**

把 import 改为：

```ts
import { createStationDraft, listMyVenueApplications, uploadTicketAsset } from '@/lib/api'
import { LocalFileUpload } from '@/components/LocalFileUpload'
```

- [ ] **Step 2: 增加 state**

在 `stationName` 附近增加：

```ts
const [poster, setPoster] = useState('')
const [uploadingPoster, setUploadingPoster] = useState(false)
```

- [ ] **Step 3: 保存时带 poster**

在 `createStationDraft` 请求体里加入：

```ts
poster: poster.trim() || null,
```

- [ ] **Step 4: 添加上传处理函数**

在 `handleSubmit` 前添加：

```ts
const handlePosterUpload = async (file: File) => {
  if (!userId) throw new Error('请先登录')
  setUploadingPoster(true)
  try {
    const asset = await uploadTicketAsset({ userId, bizType: 'station-poster', file })
    setPoster(asset.publicUrl)
    return asset.publicUrl
  } finally {
    setUploadingPoster(false)
  }
}
```

- [ ] **Step 5: 表单中增加上传控件**

在“城市站点名”输入后、“仅官宣城市”勾选前插入：

```tsx
<div className="mb-3">
  <LocalFileUpload
    label="城市站海报"
    value={poster}
    accept="image/jpeg,image/png,image/webp,image/gif"
    uploading={uploadingPoster}
    onUpload={handlePosterUpload}
    onChange={setPoster}
    hint="支持 JPG、PNG、WEBP、GIF；不上传时会使用巡演主海报。"
  />
</div>
```

- [ ] **Step 6: 上传中禁用保存按钮**

保存按钮改为：

```tsx
<button onClick={handleSubmit} disabled={submitting || uploadingPoster} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
  {submitting ? '保存中...' : uploadingPoster ? '海报上传中...' : '保存站点草稿'}
</button>
```

---

### Task 2: 巡演详情站点卡片展示海报

**Files:**
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`

- [ ] **Step 1: 在站点 map 中计算图片 URL**

在 `stationDetails.map(item => {` 内部，`publishForm` 前增加：

```ts
const posterUrl = item.station.poster || detail.tour.poster || '/background.png'
```

- [ ] **Step 2: 调整卡片布局展示图片**

把卡片开头的内容结构改为：

```tsx
return <div key={item.station.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
      <img src={posterUrl} alt={item.station.stationName} className="h-32 w-full rounded-xl object-cover sm:w-48" />
      <div>
        <div className="text-[16px] font-bold text-[#333]">{item.station.city} · {item.station.stationName}</div>
        <div className="mt-2 grid gap-1 text-[13px] text-[#666] sm:grid-cols-2">
          <div>销售状态：{formatStationStatus(item)}</div>
          <div>发布状态：{formatPublishStatus(item.station.publishStatus)}</div>
          <div>场馆：{item.venueName || '未公布'}</div>
          <div>票价：{formatPrice(item.priceMin, item.priceMax)}</div>
          <div>场次数：{item.sessions.length}</div>
          <div>剩余库存：{formatRemainStock(item)}</div>
        </div>
      </div>
    </div>
    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{item.saleStatusText || '未公布'}</span>
  </div>
```

保留后面的 `canPublish` 发布表单不变。

---

### Task 3: 验证

**Files:**
- No code changes.

- [ ] **Step 1: 前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

- [ ] **Step 2: 限定文件空白检查**

Run:

```powershell
git diff --check -- "docs/superpowers/plans/2026-05-23-station-poster-upload-display.md" "frontend/src/app/console/tours/[id]/stations/new/page.tsx" "frontend/src/app/console/tours/[id]/page.tsx"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: 无 trailing whitespace 报错。LF/CRLF warning 可接受。

---

## Self-Review

- Spec coverage: 覆盖城市站新增页上传、保存 poster 字段、巡演详情站点卡片展示、fallback 顺序。
- Placeholder scan: 未使用 TBD/TODO/稍后实现等占位描述。
- Type consistency: `StationEntity.poster` 已存在；`uploadTicketAsset` 已支持 `station-poster`；`LocalFileUpload` 已在其他页面复用。
- Scope check: 单一前端集成任务，不包含城市站编辑页、私有证明材料或 SeatCraft。
