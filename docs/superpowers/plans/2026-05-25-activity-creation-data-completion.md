# Activity Creation Data Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让新建活动流程可上传场地审批凭证附件，并在场馆选择时使用自己已通过的场地申请，降低模拟种子不完整对创建活动的阻塞。

**Architecture:** 前端活动创建页复用现有 `PrivateFileUpload` 和 `uploadPrivateAsset`，不新增文件存储后端。场馆选择合并平台场馆和当前账号已通过且已关联 `venueId` 的场地申请；创建活动时保存所选 `venueApplicationId` 和凭证附件标识字符串，创建场次仍使用实际 `venueId`，避免修改订单/场次边界。

**Tech Stack:** Next.js 16 + React 19 + TypeScript，现有 `src/lib/api.ts` 请求封装，现有 `PrivateFileUpload` / `LocalFileUpload` 组件。

---

## File Structure

- Modify: `frontend/src/app/console/activities/new/page.tsx`，活动创建页新增凭证私有上传、已通过场地申请加载、合并场馆选择。
- Modify: `frontend/src/lib/api.ts`，复用 `listMyVenueApplications()` / `uploadPrivateAsset()`，不新增接口。
- Modify: `frontend/src/types/api.ts`，如发现类型字段缺失则补齐；当前 `VenueApplicationVO` 已有 `venueId/proofAsset/proofAssetId`。

### Task 1: Activity Form Venue Proof Upload

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`

- [x] **Step 1: Add private proof upload state**

Add imports:

```ts
import { listMyVenueApplications, uploadPrivateAsset } from '@/lib/api'
import { PrivateFileUpload } from '@/components/PrivateFileUpload'
import type { PrivateAssetVO, VenueApplicationVO } from '@/types/api'
```

Add state:

```ts
const [venueApplications, setVenueApplications] = useState<VenueApplicationVO[]>([])
const [venueApprovalAsset, setVenueApprovalAsset] = useState<PrivateAssetVO | null>(null)
const [uploadingVenueApproval, setUploadingVenueApproval] = useState(false)
```

- [x] **Step 2: Load approved venue applications**

Inside the existing user `useEffect`, call:

```ts
listMyVenueApplications()
  .then(items => setVenueApplications(items.filter(item => item.status === 1 && item.venueId != null)))
  .catch(() => setVenueApplications([]))
```

- [x] **Step 3: Replace raw proof URL field with PrivateFileUpload**

In the venue proof section, keep proof number and note inputs. Replace the `venueApprovalFileUrl` text input with:

```tsx
<PrivateFileUpload
  label="场地审批凭证附件"
  value={venueApprovalAsset}
  accept="application/pdf,image/jpeg,image/png,image/webp"
  uploading={submitting || uploadingVenueApproval}
  onUpload={handleVenueApprovalUpload}
  onChange={setVenueApprovalAsset}
  hint="支持 PDF、JPEG、PNG、WEBP；附件以私有文件保存，仅供平台审核。"
/>
```

Add handler:

```ts
const handleVenueApprovalUpload = async (file: File) => {
  const u = getUser()
  if (!u?.userId) throw new Error('请先登录')
  setUploadingVenueApproval(true)
  try {
    return await uploadPrivateAsset({ userId: u.userId, bizType: 'activity-venue-proof', file })
  } finally {
    setUploadingVenueApproval(false)
  }
}
```

- [x] **Step 4: Submit private proof identifier**

When calling `createAdminActivity`, set:

```ts
venueApprovalFileUrl: venueApprovalAsset ? `private-asset:${venueApprovalAsset.id}` : venueApprovalFileUrl.trim() || null,
```

Do not add a new database column in this iteration.

### Task 2: Activity Form Venue Application Choices

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`

- [x] **Step 1: Add selected source model**

Extend `SessionDraft` with:

```ts
venueApplicationId: number | null
```

Initialize sessions as:

```ts
[{ key: 's1', venueId: null, venueApplicationId: null, startTime: '', endTime: '' }]
```

- [x] **Step 2: Update venue selector**

Render two option groups:

```tsx
<optgroup label="平台场馆">
  {venues.map(v => <option key={`venue:${v.id}`} value={`venue:${v.id}`}>{v.name} ({v.city})</option>)}
</optgroup>
<optgroup label="我的已通过场地申请">
  {venueApplications.map(item => <option key={`application:${item.id}`} value={`application:${item.id}`}>{item.venueName} ({item.city})</option>)}
</optgroup>
```

Add helpers:

```ts
function sessionVenueValue(session: SessionDraft) {
  return session.venueApplicationId ? `application:${session.venueApplicationId}` : session.venueId ? `venue:${session.venueId}` : ''
}

function resolveVenueSelection(value: string, applications: VenueApplicationVO[]) {
  if (!value) return { venueId: null, venueApplicationId: null }
  const [type, rawId] = value.split(':')
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return { venueId: null, venueApplicationId: null }
  if (type === 'application') {
    const application = applications.find(item => item.id === id)
    return { venueId: application?.venueId ?? null, venueApplicationId: application?.id ?? null }
  }
  return { venueId: id, venueApplicationId: null }
}
```

- [x] **Step 3: Submit selected venue application**

When creating the activity, set:

```ts
venueApplicationId: sessions.find(s => s.venueApplicationId)?.venueApplicationId ?? null,
```

When creating sessions, still send `venueId: s.venueId`.

### Task 3: Verification

- [x] Run `pnpm typecheck` in `frontend`.
- [x] Run existing SeatCraft frontend targeted tests only if touched files affect shared SeatCraft types: not available in current `frontend/package.json`; covered with `pnpm typecheck`.
- [x] Run `git diff --check -- frontend/src/app/console/activities/new/page.tsx frontend/src/lib/api.ts frontend/src/types/api.ts`.

## Self Review

- Spec coverage: covers proof upload, self uploaded/approved venue choice, and activity payload linkage.
- Scope intentionally excludes巡演待公布 and票档待公布; those are next sequential projects.
- Type consistency: `VenueApplicationVO.venueId` exists and `PrivateAssetVO.id` exists.
