# SeatCraft Versioned Frontend Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the activity and session SeatCraft designer pages from legacy `/seat-layout` save/load APIs to the new versioned SeatCraft draft/publish APIs, and expose version metadata in frontend types.

**Architecture:** Keep the existing SeatCraft designer UI and draft model. Add version metadata to `SeatCraftLayoutVO` and `SeatCraftLayoutDraft`, add focused versioned API wrappers in `frontend/src/lib/api.ts`, then update only the activity/session designer pages to load/save/publish drafts through `/api/ticket/admin/seatcraft/{ownerType}/{ownerId}/...`. Venue default layout remains on the legacy API.

**Tech Stack:** Next.js 16, React 19, TypeScript, existing `request<T>()` API wrapper, Node built-in test runner for SeatCraft pure helpers.

---

## File Structure

- Modify `frontend/src/types/api.ts`: add `versionId`, `versionNo`, `versionStatus` to `SeatCraftLayoutVO`; add `SeatCraftVersionSummaryVO`.
- Modify `frontend/src/components/seatcraft/types.ts`: add version metadata fields to `SeatCraftLayoutDraft`; preserve them in `toSeatCraftLayoutDraft()`.
- Modify `frontend/src/components/seatcraft/block-layout.test.ts`: add a failing test that proves version metadata survives VO -> draft conversion.
- Modify `frontend/src/lib/api.ts`: add versioned SeatCraft API functions and keep legacy activity/session blank layout functions.
- Modify `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`: load/save/publish through ownerType `activity`.
- Modify `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`: load/save/publish through ownerType `session` and keep session seats from the legacy layout load only as a fallback if needed.

---

### Task 1: Preserve Version Metadata In SeatCraft Types

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/seatcraft/types.ts`
- Test: `frontend/src/components/seatcraft/block-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `frontend/src/components/seatcraft/block-layout.test.ts` near the existing `toSeatCraftLayoutDraft()` tests:

```ts
test('layout draft preserves version metadata from versioned SeatCraft API', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
  }))

  assert.equal(draft.versionId, 88)
  assert.equal(draft.versionNo, 5)
  assert.equal(draft.versionStatus, 'draft')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run in `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types --test-name-pattern "version metadata" "src/components/seatcraft/block-layout.test.ts"
```

Expected: FAIL because `SeatCraftLayoutDraft` and `toSeatCraftLayoutDraft()` do not expose `versionId`, `versionNo`, and `versionStatus` yet.

- [ ] **Step 3: Add API and draft fields**

In `frontend/src/types/api.ts`, update `SeatCraftLayoutVO`:

```ts
export interface SeatCraftLayoutVO {
  id: number
  versionId?: number | null
  versionNo?: number | null
  versionStatus?: string | null
  venueId?: number | null
  activityId?: number | null
  sessionId?: number | null
  name: string
  templateType: SeatCraftTemplateType
  stageTitle: string
  stageX: number
  stageY: number
  canvasWidth: number
  canvasHeight: number
  sections: SeatCraftSectionVO[]
  seats?: SessionSeatVO[]
  blocks?: SeatCraftBlockVO[]
  overrides?: SeatOverrideVO[]
  ticketGroups?: TicketGroupVO[]
  bindings?: SeatCraftBindingVO[]
  blockLayout?: {
    name?: string | null
    canvasWidth?: number | null
    canvasHeight?: number | null
    blocks?: SeatCraftBlockVO[]
    overrides?: SeatOverrideVO[]
    ticketGroups?: TicketGroupVO[]
    bindings?: SeatCraftBindingVO[]
  } | null
}
```

In the same file, add:

```ts
export interface SeatCraftVersionSummaryVO {
  id: number
  versionNo?: number | null
  versionStatus?: string | null
  name?: string | null
  baseVersionId?: number | null
  publishedAt?: string | null
  publishedBy?: number | null
  createTime?: string | null
  updateTime?: string | null
}
```

In `frontend/src/components/seatcraft/types.ts`, update `SeatCraftLayoutDraft`:

```ts
export interface SeatCraftLayoutDraft {
  id?: number | null
  versionId?: number | null
  versionNo?: number | null
  versionStatus?: string | null
  venueId?: number | null
  activityId?: number | null
  sessionId?: number | null
  name: string
  templateType: 'concert' | 'cinema' | 'custom'
  stage: SeatCraftStage
  canvasWidth: number
  canvasHeight: number
  sections: SeatCraftSection[]
  blocks?: SeatBlockDraft[]
  overrides?: SeatOverrideDraft[]
  ticketGroups?: TicketGroupDraft[]
  bindings?: SeatCraftBinding[]
}
```

In `toSeatCraftLayoutDraft()`, preserve metadata:

```ts
return {
  id: layout.id,
  versionId: layout.versionId ?? null,
  versionNo: layout.versionNo ?? null,
  versionStatus: layout.versionStatus ?? null,
  venueId: layout.venueId ?? null,
  activityId: layout.activityId ?? null,
  sessionId: layout.sessionId ?? null,
  // existing fields stay unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types --test-name-pattern "version metadata" "src/components/seatcraft/block-layout.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "frontend/src/types/api.ts" "frontend/src/components/seatcraft/types.ts" "frontend/src/components/seatcraft/block-layout.test.ts"
git commit -m "feat: preserve SeatCraft version metadata on frontend"
```

---

### Task 2: Add Versioned SeatCraft API Wrappers

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add typed owner helpers and API functions**

In `frontend/src/lib/api.ts`, after `updateActivitySeatLayout()` and before venue default layout functions, add:

```ts
export type SeatCraftOwnerType = 'activity' | 'session'

function assertSeatCraftOwner(ownerType: SeatCraftOwnerType, ownerId: number) {
  if (ownerType !== 'activity' && ownerType !== 'session') {
    throw new Error('SeatCraft 归属类型无效')
  }
  assertPositiveInteger(ownerId, 'SeatCraft 归属ID')
}

export async function getSeatCraftDraft(ownerType: SeatCraftOwnerType, ownerId: number) {
  assertSeatCraftOwner(ownerType, ownerId)
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/draft`)
}

export async function saveSeatCraftDraft(ownerType: SeatCraftOwnerType, ownerId: number, layout: import('@/types/api').SeatCraftLayoutVO) {
  assertSeatCraftOwner(ownerType, ownerId)
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/draft`, {
    method: 'PUT',
    body: JSON.stringify(layout),
  })
}

export async function publishSeatCraftDraft(ownerType: SeatCraftOwnerType, ownerId: number) {
  assertSeatCraftOwner(ownerType, ownerId)
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/publish`, {
    method: 'POST',
  })
}

export async function listSeatCraftVersions(ownerType: SeatCraftOwnerType, ownerId: number) {
  assertSeatCraftOwner(ownerType, ownerId)
  return request<import('@/types/api').SeatCraftVersionSummaryVO[]>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/versions`)
}

export async function rollbackSeatCraftVersion(ownerType: SeatCraftOwnerType, ownerId: number, versionId: number) {
  assertSeatCraftOwner(ownerType, ownerId)
  assertPositiveInteger(versionId, 'SeatCraft 版本ID')
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/versions/${versionId}/rollback`, {
    method: 'POST',
  })
}
```

- [ ] **Step 2: Run typecheck**

Run in `frontend`:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add "frontend/src/lib/api.ts" "frontend/src/types/api.ts"
git commit -m "feat: add versioned SeatCraft frontend API wrappers"
```

---

### Task 3: Switch Activity SeatCraft Page To Versioned Draft API

**Files:**
- Modify: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`

- [ ] **Step 1: Replace imports**

Change the API import to:

```ts
import { createBlankActivitySeatLayout, getSeatCraftDraft, publishSeatCraftDraft, saveSeatCraftDraft } from '@/lib/api'
```

- [ ] **Step 2: Load draft through versioned API**

Replace `getActivitySeatLayout(activityId, user.userId)` with:

```ts
getSeatCraftDraft('activity', activityId)
```

Keep the success handler:

```ts
setLayout(response ? toSeatCraftLayoutDraft(response) : null)
```

- [ ] **Step 3: Save draft through versioned API**

Replace `updateActivitySeatLayout(...)` with:

```ts
const response = await saveSeatCraftDraft('activity', activityId, toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? activityId }))
setLayout(toSeatCraftLayoutDraft(response))
setMessage('草稿已保存')
```

- [ ] **Step 4: Add publish handler**

Add state:

```ts
const [publishing, setPublishing] = useState(false)
```

Add handler:

```ts
const handlePublish = async () => {
  if (!layout) return
  setPublishing(true)
  setError('')
  setMessage('')
  try {
    const response = await publishSeatCraftDraft('activity', activityId)
    setLayout(toSeatCraftLayoutDraft(response))
    setMessage('座位图已发布')
  } catch (err) {
    setError(err instanceof Error ? err.message : '发布座位图失败')
  } finally {
    setPublishing(false)
  }
}
```

- [ ] **Step 5: Show version status and publish button**

In the action bar, add status text and publish button:

```tsx
{layout && (
  <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">
    {layout.versionStatus === 'published' ? '已发布' : '草稿'}{layout.versionNo ? ` · v${layout.versionNo}` : ''}
  </span>
)}
<button
  onClick={handlePublish}
  disabled={!layout || publishing}
  className="rounded-lg border border-[#ff1268] px-4 py-2 text-[14px] font-medium text-[#ff1268] disabled:opacity-50"
>
  {publishing ? '发布中...' : '发布'}
</button>
```

- [ ] **Step 6: Keep blank layout behavior**

Keep `createBlankActivitySeatLayout(activityId, user.userId)` unchanged. It remains the initial empty canvas creator when no draft exists. The next save writes the draft through the versioned API.

- [ ] **Step 7: Run typecheck**

Run in `frontend`:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add "frontend/src/app/console/activities/[id]/seat-layout/page.tsx"
git commit -m "feat: use versioned SeatCraft draft API for activity layouts"
```

---

### Task 4: Switch Session SeatCraft Page To Versioned Draft API

**Files:**
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`

- [ ] **Step 1: Replace imports**

Change the API import to:

```ts
import { createBlankSessionSeatLayout, getSeatCraftDraft, publishSeatCraftDraft, saveSeatCraftDraft } from '@/lib/api'
```

- [ ] **Step 2: Load draft through versioned API**

Replace `getSessionSeatLayout(sessionId, user.userId)` with:

```ts
getSeatCraftDraft('session', sessionId)
```

Keep:

```ts
setLayout(response ? toSeatCraftLayoutDraft(response) : null)
setSessionSeats(response?.seats ?? [])
```

Note: versioned draft responses may not include sold-seat status. If `sessionSeats` is empty after this switch, design mode still works; sold-seat protection remains enforced after publish/session materialization. A follow-up can add a dedicated session seat status load if the UI needs occupied-seat overlays while editing drafts.

- [ ] **Step 3: Save draft through versioned API**

Replace `updateSessionSeatLayout(...)` with:

```ts
const response = await saveSeatCraftDraft('session', sessionId, toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? 0 }))
setLayout(toSeatCraftLayoutDraft(response))
setSessionSeats(response.seats ?? [])
setMessage('草稿已保存')
```

- [ ] **Step 4: Add publish handler**

Add state:

```ts
const [publishing, setPublishing] = useState(false)
```

Add handler:

```ts
const handlePublish = async () => {
  if (!layout) return
  setPublishing(true)
  setError('')
  setMessage('')
  try {
    const response = await publishSeatCraftDraft('session', sessionId)
    setLayout(toSeatCraftLayoutDraft(response))
    setSessionSeats(response.seats ?? [])
    setMessage('场次 SeatCraft 座位图已发布')
  } catch (err) {
    setError(err instanceof Error ? err.message : '发布场次 SeatCraft 座位图失败')
  } finally {
    setPublishing(false)
  }
}
```

- [ ] **Step 5: Show version status and publish button**

In the action bar, add:

```tsx
{layout && (
  <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">
    {layout.versionStatus === 'published' ? '已发布' : '草稿'}{layout.versionNo ? ` · v${layout.versionNo}` : ''}
  </span>
)}
<button
  onClick={handlePublish}
  disabled={!layout || publishing}
  className="rounded-lg border border-[#ff1268] px-4 py-2 text-[14px] font-medium text-[#ff1268] disabled:opacity-50"
>
  {publishing ? '发布中...' : '发布'}
</button>
```

- [ ] **Step 6: Keep blank layout behavior**

Keep `createBlankSessionSeatLayout(sessionId, user.userId)` unchanged. It remains the initial empty canvas creator when no draft exists. The next save writes the draft through the versioned API.

- [ ] **Step 7: Run typecheck**

Run in `frontend`:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add "frontend/src/app/console/sessions/[id]/seat-layout/page.tsx"
git commit -m "feat: use versioned SeatCraft draft API for session layouts"
```

---

### Task 5: Final Verification

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run SeatCraft metadata test**

Run in `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types --test-name-pattern "version metadata|binding|bindings|ticketGroupKey|primary|secondary" "src/components/seatcraft/block-layout.test.ts"
```

Expected: PASS for selected tests.

- [ ] **Step 2: Run frontend typecheck**

Run in `frontend`:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run limited whitespace check**

Run in repo root:

```powershell
git diff --check -- frontend/src/types/api.ts frontend/src/components/seatcraft/types.ts frontend/src/components/seatcraft/block-layout.test.ts frontend/src/lib/api.ts frontend/src/app/console/activities/[id]/seat-layout/page.tsx frontend/src/app/console/sessions/[id]/seat-layout/page.tsx docs/superpowers/plans/2026-05-25-seatcraft-versioned-frontend-endpoints.md
```

Expected: no whitespace errors. LF/CRLF warnings are acceptable on Windows.

- [ ] **Step 4: Commit final verification fixes if any**

If Step 3 finds whitespace errors, fix only those lines and commit:

```powershell
git add <fixed-files>
git commit -m "fix: clean SeatCraft versioned frontend endpoint whitespace"
```

If no fixes are needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: covers version metadata fields, versioned API wrappers, activity/session page switch, publish button, and final verification.
- Scope check: venue default layout is explicitly out of scope and remains on legacy endpoint.
- Ambiguity check: blank layout endpoints remain legacy initializers; save/publish use versioned APIs.
- Placeholder scan: no TBD/TODO placeholders remain.
