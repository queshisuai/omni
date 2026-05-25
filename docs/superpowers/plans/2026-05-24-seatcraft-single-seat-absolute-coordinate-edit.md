# SeatCraft Single Seat Absolute Coordinate Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add design-mode single-seat selection and right-panel absolute `X/Y` editing while continuing to persist `SeatOverride.dx/dy`.

**Architecture:** Keep the existing `SeatLayoutDesigner` as the state owner. `SeatCanvas` only reports seat clicks and renders the active seat highlight. `SeatLayoutControls` renders a small seat-property editor and calls back with absolute coordinates; `SeatLayoutDesigner` converts them to existing override updates through `moveSeat()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, existing SeatCraft components and Node native tests.

---

## File Structure

- Modify `frontend/src/components/seatcraft/types.ts`
  - Add `ActiveSeatKey` and `ActiveSeatDetails` types.
  - Extend `SeatCanvasProps` with `activeSeatKey` and `onSeatSelect`.
  - Extend `SeatLayoutControlsProps` with `activeSeat`, `onSelectSeat`, and `onUpdateSeatPosition`.
- Modify `frontend/src/components/seatcraft/SeatCanvas.tsx`
  - Render active seat highlight using `activeSeatKey`.
  - Notify `onSeatSelect` on design-mode seat click when the tool is not `eraser`.
- Modify `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
  - Own `activeSeatKey`.
  - Resolve selected seat from `sectionSeats`.
  - Clear invalid selected seats.
  - Reuse `moveSeat()` for absolute coordinate edits with a dedicated history merge key.
- Modify `frontend/src/components/seatcraft/SeatLayoutControls.tsx`
  - Add a “座位属性” panel for active seat details.
  - Disable coordinate editing for occupied, hidden/deleted, or missing-base seats.
- Create `frontend/src/components/seatcraft/seat-selection.ts`
  - Small pure helpers for seat key matching and editability.
- Create `frontend/src/components/seatcraft/seat-selection.test.ts`
  - Node native tests for pure helper behavior.

---

### Task 1: Seat Selection Helper RED/GREEN

**Files:**
- Create: `frontend/src/components/seatcraft/seat-selection.test.ts`
- Create: `frontend/src/components/seatcraft/seat-selection.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `frontend/src/components/seatcraft/seat-selection.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { canEditSeatPosition, isSeatKeyMatch, seatEditDisabledReason } from './seat-selection.ts'
import type { ActiveSeatKey, SeatCraftSeat } from './types.ts'

function seat(overrides: Partial<SeatCraftSeat> = {}): SeatCraftSeat {
  return {
    id: 'block-a-1-2',
    row: 0,
    col: 1,
    x: 120,
    y: 220,
    baseX: 100,
    baseY: 200,
    angle: 0,
    status: 'available',
    price: 0,
    sectionKey: 'block-a',
    sectionName: 'A 区',
    label: '2',
    ...overrides,
  }
}

test('seat key matches by block key and logical row seat numbers', () => {
  const key: ActiveSeatKey = { blockKey: 'block-a', rowNo: 1, seatNo: 2 }

  assert.equal(isSeatKeyMatch(key, seat()), true)
  assert.equal(isSeatKeyMatch({ ...key, seatNo: 3 }, seat()), false)
})

test('available seat with base coordinates is editable', () => {
  assert.equal(canEditSeatPosition(seat()), true)
  assert.equal(seatEditDisabledReason(seat()), null)
})

test('occupied and deleted seats are not editable', () => {
  assert.equal(canEditSeatPosition(seat({ status: 'occupied' })), false)
  assert.equal(seatEditDisabledReason(seat({ status: 'occupied' })), '不可移动已占用座位')
  assert.equal(canEditSeatPosition(seat({ status: 'deleted' })), false)
  assert.equal(seatEditDisabledReason(seat({ status: 'deleted' })), '请先恢复座位后再编辑坐标')
})

test('seat without base coordinates is not editable', () => {
  assert.equal(canEditSeatPosition(seat({ baseX: undefined })), false)
  assert.equal(seatEditDisabledReason(seat({ baseX: undefined })), '无法计算座位偏移')
})
```

- [ ] **Step 2: Run RED test**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/seat-selection.test.ts"
```

Expected: FAIL because `seat-selection.ts` does not exist.

- [ ] **Step 3: Implement minimal helper module**

Create `frontend/src/components/seatcraft/seat-selection.ts`:

```ts
import type { ActiveSeatKey, SeatCraftSeat } from './types'

export function isSeatKeyMatch(key: ActiveSeatKey | null, seat: SeatCraftSeat) {
  if (!key) return false
  return key.blockKey === seat.sectionKey && key.rowNo === seat.row + 1 && key.seatNo === seat.col + 1
}

export function seatEditDisabledReason(seat: SeatCraftSeat | null) {
  if (!seat) return '未选中座位'
  if (seat.status === 'occupied') return '不可移动已占用座位'
  if (seat.status === 'deleted') return '请先恢复座位后再编辑坐标'
  if (seat.baseX == null || seat.baseY == null) return '无法计算座位偏移'
  return null
}

export function canEditSeatPosition(seat: SeatCraftSeat | null) {
  return seatEditDisabledReason(seat) == null
}
```

- [ ] **Step 4: Add exported types**

Modify `frontend/src/components/seatcraft/types.ts` near the seat interfaces:

```ts
export interface ActiveSeatKey {
  blockKey: string
  rowNo: number
  seatNo: number
}

export interface ActiveSeatDetails {
  key: ActiveSeatKey
  blockName: string
  seat: SeatCraftSeat
}
```

- [ ] **Step 5: Run GREEN test**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/seat-selection.test.ts"
```

Expected: PASS, 4 tests passing.

---

### Task 2: Canvas Active Seat Selection

**Files:**
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/components/seatcraft/SeatCanvas.tsx`

- [ ] **Step 1: Extend canvas props**

Modify `SeatCanvasProps` in `frontend/src/components/seatcraft/types.ts`:

```ts
  activeSeatKey?: ActiveSeatKey | null
  onSeatSelect?: (seatKey: ActiveSeatKey | null) => void
```

Keep the existing `selectedSeatIds`, `onSeatMove`, and `onSeatClick` props unchanged.

- [ ] **Step 2: Import helper and props in canvas**

Modify the import section of `frontend/src/components/seatcraft/SeatCanvas.tsx`:

```ts
import { isSeatKeyMatch } from './seat-selection'
import type { ActiveSeatKey, SeatBlockDraft, SeatCanvasProps, SeatCanvasToolMode, SeatCraftSeat } from './types'
```

Include the new props in the component destructuring:

```ts
  activeSeatKey = null,
  onSeatSelect,
```

- [ ] **Step 3: Pass active seat information into `renderBlock`**

Update the `blocks.map` call so `renderBlock` receives `activeSeatKey` and `onSeatSelect`:

```tsx
{blocks.map(block => renderBlock(
  block,
  seatsByBlock[block.blockKey] ?? [],
  interactionMode,
  activeKeys.includes(block.blockKey),
  startBlockDrag,
  startBlockRotate,
  startBlockResize,
  startSeatDrag,
  startPolygonPointDrag,
  onSeatClick,
  toolMode,
  activeSeatKey,
  onSeatSelect,
  (b) => onBlockSelect?.([b.blockKey]),
))}
```

Update the `renderBlock` signature to include:

```ts
  activeSeatKey: ActiveSeatKey | null,
  onSeatSelect?: (seatKey: ActiveSeatKey | null) => void,
```

- [ ] **Step 4: Pass active selection into `renderSeat`**

Change every `renderSeat(...)` call inside `renderBlock` to pass `activeSeatKey` and `onSeatSelect` before `onSeatClick`:

```ts
renderSeat(block, seat, mode, canSelectSeat, toolMode, onSeatPointerDown, activeSeatKey, onSeatSelect, onSeatClick)
```

There are calls in the polygon branch and the default branch.

- [ ] **Step 5: Update `renderSeat` behavior**

Update `renderSeat` signature near the bottom of `SeatCanvas.tsx`:

```ts
function renderSeat(
  block: SeatBlockDraft,
  seat: SeatCraftSeat,
  mode: string,
  selectableSeat: boolean,
  toolMode: SeatCanvasToolMode,
  onSeatPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => void,
  activeSeatKey: ActiveSeatKey | null,
  onSeatSelect?: (seatKey: ActiveSeatKey | null) => void,
  onSeatClick?: (seat: SeatCraftSeat) => void,
) {
```

Inside `renderSeat`, add:

```ts
  const activeInDesign = mode === 'design' && isSeatKeyMatch(activeSeatKey, seat)
```

In the `onClick` handler, use this logic:

```ts
      onClick={(event) => {
        if (mode === 'design') {
          event.stopPropagation()
          if (toolMode === 'eraser') {
            onSeatClick?.(seat)
            return
          }
          onSeatSelect?.({ blockKey: seat.sectionKey, rowNo: seat.row + 1, seatNo: seat.col + 1 })
          if (toolMode !== 'seatMove') onSeatClick?.(seat)
        } else if (selectableSeat) {
          onSeatClick?.(seat)
        }
      }}
```

Update the seat rectangle styling to show active highlight:

```tsx
        stroke={activeInDesign ? '#ffffff' : (isDeleted ? '#555' : fill)}
        strokeWidth={activeInDesign ? 3 : (isSelected ? 2 : 1.5)}
```

- [ ] **Step 6: Verify typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

---

### Task 3: Designer Active Seat State and Coordinate Updates

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Import new types and helper**

Modify imports:

```ts
import { canEditSeatPosition } from './seat-selection'
import { makeBlockKey, makeDefaultStage, type ActiveSeatDetails, type ActiveSeatKey, type SeatBlockType, type SeatCanvasToolMode, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'
```

- [ ] **Step 2: Add active seat state**

Inside `SeatLayoutDesigner`, after `toolMode` state:

```ts
  const [activeSeatKey, setActiveSeatKey] = useState<ActiveSeatKey | null>(null)
```

- [ ] **Step 3: Resolve active seat details**

After `sectionSeats` is created, add:

```ts
  const activeSeatDetails: ActiveSeatDetails | null = (() => {
    if (!activeSeatKey) return null
    const block = blocks.find(item => item.blockKey === activeSeatKey.blockKey)
    if (!block) return null
    const seat = sectionSeats[activeSeatKey.blockKey]?.find(item => item.row + 1 === activeSeatKey.rowNo && item.col + 1 === activeSeatKey.seatNo)
    if (!seat) return null
    return { key: activeSeatKey, blockName: block.name, seat }
  })()
```

- [ ] **Step 4: Clear invalid active seat**

Add an effect after the active block validation effect:

```ts
  useEffect(() => {
    if (activeSeatKey && !activeSeatDetails) {
      setActiveSeatKey(null)
    }
  }, [activeSeatKey, activeSeatDetails])
```

In `deleteBlock`, before or after active block cleanup, add:

```ts
    if (activeSeatKey?.blockKey === blockKey) {
      setActiveSeatKey(null)
    }
```

- [ ] **Step 5: Let `moveSeat` accept commit options**

Change the function signature:

```ts
  const moveSeat = (blockKey: string, rowNo: number, seatNo: number, x: number, y: number, baseX: number, baseY: number, options?: CommitOptions) => {
```

Change the final update call:

```ts
    updateBlock(blockKey, { overrides: nextOverrides }, options ?? { mergeKey: `move:seat:${blockKey}:${rowNo}:${seatNo}` })
```

- [ ] **Step 6: Add coordinate edit handler**

Add after `moveSeat`:

```ts
  const updateSeatPosition = (seatKey: ActiveSeatKey, x: number, y: number) => {
    const details = activeSeatDetails
    if (!details || details.key.blockKey !== seatKey.blockKey || details.key.rowNo !== seatKey.rowNo || details.key.seatNo !== seatKey.seatNo) return
    if (!canEditSeatPosition(details.seat)) return
    moveSeat(seatKey.blockKey, seatKey.rowNo, seatKey.seatNo, x, y, details.seat.baseX ?? 0, details.seat.baseY ?? 0, {
      mergeKey: `edit:seat-position:${seatKey.blockKey}:${seatKey.rowNo}:${seatKey.seatNo}`,
    })
  }
```

- [ ] **Step 7: Wire canvas active seat props**

In `<SeatCanvas />`, add:

```tsx
          activeSeatKey={activeSeatKey}
          onSeatSelect={seatKey => {
            setActiveSeatKey(seatKey)
            if (seatKey?.blockKey) setActiveBlockKeys([seatKey.blockKey])
          }}
```

- [ ] **Step 8: Keep eraser from leaving stale seat selection**

Inside the existing `onSeatClick` eraser branch, after calculating `rowNo` and `seatNo`, add:

```ts
              if (activeSeatKey?.blockKey === block.blockKey && activeSeatKey.rowNo === rowNo && activeSeatKey.seatNo === seatNo) {
                setActiveSeatKey(null)
              }
```

- [ ] **Step 9: Pass active seat to controls**

In `<SeatLayoutControls />`, add:

```tsx
          activeSeat={activeSeatDetails}
          onSelectSeat={setActiveSeatKey}
          onUpdateSeatPosition={updateSeatPosition}
```

- [ ] **Step 10: Verify typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

---

### Task 4: Right Panel Seat Property Editor

**Files:**
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`

- [ ] **Step 1: Extend controls props**

Modify `SeatLayoutControlsProps` in `frontend/src/components/seatcraft/types.ts`:

```ts
  activeSeat?: ActiveSeatDetails | null
  onSelectSeat?: (seatKey: ActiveSeatKey | null) => void
  onUpdateSeatPosition?: (seatKey: ActiveSeatKey, x: number, y: number) => void
```

- [ ] **Step 2: Import helper and types**

Modify `frontend/src/components/seatcraft/SeatLayoutControls.tsx` imports:

```ts
import { seatEditDisabledReason } from './seat-selection'
import type { ActiveSeatDetails, ActiveSeatKey, SeatBlockDraft, SeatBlockType, SeatLayoutControlsProps } from './types'
```

- [ ] **Step 3: Destructure new props**

In `SeatLayoutControls` params, add:

```ts
  activeSeat,
  onSelectSeat,
  onUpdateSeatPosition,
```

- [ ] **Step 4: Render the seat editor**

After the Info List section and before the horizontal divider at line near `73`, insert:

```tsx
          {activeSeat && (
            <SeatPositionEditor
              activeSeat={activeSeat}
              onClear={() => onSelectSeat?.(null)}
              onUpdatePosition={onUpdateSeatPosition}
            />
          )}
```

- [ ] **Step 5: Add `SeatPositionEditor` component**

Add below `ReadonlyRow`:

```tsx
function SeatPositionEditor({
  activeSeat,
  onClear,
  onUpdatePosition,
}: {
  activeSeat: ActiveSeatDetails
  onClear: () => void
  onUpdatePosition?: (seatKey: ActiveSeatKey, x: number, y: number) => void
}) {
  const { key, blockName, seat } = activeSeat
  const reason = seatEditDisabledReason(seat)
  const editable = reason == null
  const dx = seat.baseX == null ? 0 : seat.x - seat.baseX
  const dy = seat.baseY == null ? 0 : seat.y - seat.baseY

  const updateX = (value: number) => {
    if (!editable) return
    onUpdatePosition?.(key, value, seat.y)
  }
  const updateY = (value: number) => {
    if (!editable) return
    onUpdatePosition?.(key, seat.x, value)
  }

  return (
    <div className="rounded-lg border border-[#ff1268]/25 bg-[#ff1268]/5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-white">座位属性</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">{blockName} · 第 {key.rowNo} 排 · 第 {key.seatNo} 座</div>
        </div>
        <button type="button" onClick={onClear} className="text-[10px] text-zinc-500 hover:text-white">取消</button>
      </div>
      <div className="space-y-2 text-[11px] text-zinc-400">
        <div className="flex justify-between"><span>状态</span><span className="text-zinc-200">{seat.status}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X坐标" value={Math.round(seat.x)} onChange={updateX} />
          <NumberField label="Y坐标" value={Math.round(seat.y)} onChange={updateY} />
        </div>
        {!editable && <div className="rounded-md bg-black/20 px-2 py-1 text-[10px] text-amber-300">{reason}</div>}
        <div className="grid grid-cols-2 gap-2">
          <ReadonlyRow label="基准X" value={`${Math.round(seat.baseX ?? 0)}`} />
          <ReadonlyRow label="基准Y" value={`${Math.round(seat.baseY ?? 0)}`} />
          <ReadonlyRow label="偏移X" value={`${Math.round(dx)}`} />
          <ReadonlyRow label="偏移Y" value={`${Math.round(dy)}`} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Disable coordinate input when not editable**

If `NumberField` cannot accept `disabled`, update it to:

```tsx
function NumberField({ label, value, min, disabled, onChange }: { label: string; value: number; min?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="block space-y-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}<input type="number" min={min} disabled={disabled} value={value} onChange={event => onChange(min != null ? Math.max(min, Number(event.target.value) || min) : Number(event.target.value) || 0)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-[#ff1268] focus:bg-black/40 focus:ring-1 focus:ring-[#ff1268]/50 disabled:cursor-not-allowed disabled:opacity-50" /></label>
}
```

Then pass `disabled={!editable}` to both coordinate fields in `SeatPositionEditor`.

- [ ] **Step 7: Verify typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

---

### Task 5: Integration Verification and Regression Checks

**Files:**
- No new implementation files unless fixing issues found by verification.

- [ ] **Step 1: Run seat selection helper tests**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/seat-selection.test.ts"
```

Expected: all tests pass.

- [ ] **Step 2: Run existing SeatCraft geometry tests**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
```

Expected: polygon tests pass. Current dirty baseline has 2 known arc failures (`7 !== 3`, `27 !== 6`); record actual output if still present.

- [ ] **Step 3: Run frontend typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 4: Run targeted whitespace check**

Run from repo root:

```powershell
git diff --check -- frontend/src/components/seatcraft/types.ts frontend/src/components/seatcraft/seat-selection.ts frontend/src/components/seatcraft/seat-selection.test.ts frontend/src/components/seatcraft/SeatCanvas.tsx frontend/src/components/seatcraft/SeatLayoutDesigner.tsx frontend/src/components/seatcraft/SeatLayoutControls.tsx docs/superpowers/specs/2026-05-24-seatcraft-single-seat-absolute-coordinate-edit-design.md docs/superpowers/plans/2026-05-24-seatcraft-single-seat-absolute-coordinate-edit.md
```

Expected: no whitespace errors. LF/CRLF warnings are acceptable in this repo.

- [ ] **Step 5: Manual acceptance checklist**

After user restarts frontend dev server if needed, verify in browser:

- Select `pointer`, click a visible seat: right panel shows “座位属性”.
- Change `X坐标`: the seat moves horizontally on canvas.
- Change `Y坐标`: the seat moves vertically on canvas.
- Use Undo: the coordinate edit is reverted.
- Use Redo: the coordinate edit is restored.
- Select `eraser`, click the same seat: it hides/restores instead of opening coordinate editing.
- Occupied seat shows disabled coordinate fields when session seat data marks it occupied.

---

## Plan Self-Review

- Spec coverage: seat selection, right-panel absolute coordinate editing, `dx/dy` persistence, editability restrictions, Undo/Redo, and verification are covered by Tasks 1-5.
- Placeholder scan: no `TBD`, `TODO`, or “implement later” placeholders remain.
- Type consistency: `ActiveSeatKey`, `ActiveSeatDetails`, `activeSeatKey`, `onSeatSelect`, and `onUpdateSeatPosition` names are consistent across tasks.
- Scope check: no backend or SQL tasks are included because the approved design keeps existing `SeatOverride.dx/dy` persistence and does not change service boundaries.
