# SeatCraft Undo/Redo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SeatCraft 设计器增加本地 Undo/Redo、快捷键和工具栏按钮，同时保持现有保存 payload 与后端接口不变。

**Architecture:** Undo/Redo 状态只放在 `SeatLayoutDesigner` 内，通过统一 `commit(next, options)` 写入历史并继续调用外部 `onChange`。连续拖拽操作用 `mergeKey` 合并为单个撤销点，避免 pointermove 产生大量历史记录。页面层和后端不参与历史管理。

**Tech Stack:** Next.js 16、React 19、TypeScript、lucide-react、现有 SeatCraft 前端组件。

---

## File Structure

- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
  - 增加历史栈状态、`commit`、`undo`、`redo`、快捷键处理、工具栏按钮。
  - 给连续拖拽操作传入 `mergeKey`。
- Create: `frontend/src/components/seatcraft/history.ts`
  - 封装历史栈纯函数，避免把撤销/重做栈操作埋在组件里。
- Create: `frontend/src/components/seatcraft/history.test.ts`
  - 用 Node test 覆盖提交、撤销、重做、拖拽合并和撤销后新编辑清空 redo。
- No change: `frontend/src/components/seatcraft/SeatCanvas.tsx`
  - 初版不增加 `onInteractionEnd`，继续使用当前 pointermove 回调。
- No change: `frontend/src/components/seatcraft/types.ts`
  - 不新增公开 props，不改变现有类型契约。
- Verify: `frontend`
  - 运行 `node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/history.test.ts"`。
  - 运行 `pnpm typecheck`。

## Task 1: Add History State And Commit API

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Update React and icon imports**

Replace the existing imports at the top of `SeatLayoutDesigner.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Grid3X3, LayoutGrid, MousePointer2, Move, RotateCcw, Users, EyeOff, Undo2, Redo2 } from 'lucide-react'
```

- [ ] **Step 2: Add history types and helpers after `makeCopyBlockKey`**

Add this code after the `makeCopyBlockKey` function:

```tsx
const HISTORY_LIMIT = 50

type CommitOptions = {
  mergeKey?: string
}

type HistoryState = {
  past: SeatCraftLayoutDraft[]
  future: SeatCraftLayoutDraft[]
  lastMergeKey: string | null
  ownerKey: string
}

function ownerKeyForLayout(layout: SeatCraftLayoutDraft) {
  return [layout.sessionId ?? '', layout.activityId ?? '', layout.venueId ?? '', layout.id ?? ''].join(':')
}

function pushHistory(history: SeatCraftLayoutDraft[], snapshot: SeatCraftLayoutDraft) {
  const next = [...history, snapshot]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

function isEditableInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}
```

- [ ] **Step 3: Add history state inside `SeatLayoutDesigner`**

Inside `SeatLayoutDesigner`, after `toolMode` state, add:

```tsx
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
    lastMergeKey: null,
    ownerKey: ownerKeyForLayout(layout),
  })
  const layoutRef = useRef(layout)
```

- [ ] **Step 4: Keep current layout in a ref and reset history when owner changes**

Add this effect before the existing active-block validation effect:

```tsx
  useEffect(() => {
    layoutRef.current = layout
    const ownerKey = ownerKeyForLayout(layout)
    setHistory(current => current.ownerKey === ownerKey ? current : {
      past: [],
      future: [],
      lastMergeKey: null,
      ownerKey,
    })
  }, [layout])
```

- [ ] **Step 5: Replace the existing `commit` function**

Replace:

```tsx
  const commit = (next: SeatCraftLayoutDraft) => onChange(next)
```

with:

```tsx
  const commit = (next: SeatCraftLayoutDraft, options: CommitOptions = {}) => {
    const currentLayout = layoutRef.current
    const ownerKey = ownerKeyForLayout(currentLayout)
    setHistory(current => {
      const shouldMerge = options.mergeKey != null && current.lastMergeKey === options.mergeKey
      return {
        ownerKey,
        past: shouldMerge ? current.past : pushHistory(current.past, currentLayout),
        future: [],
        lastMergeKey: options.mergeKey ?? null,
      }
    })
    layoutRef.current = next
    onChange(next)
  }
```

- [ ] **Step 6: Run typecheck and expect current behavior to compile or reveal missing references**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: TypeScript may still pass. If it fails, only fix errors introduced by this task.

## Task 2: Add Undo/Redo Actions And Keyboard Shortcuts

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Add undo and redo functions after `commit`**

Add this code immediately after the new `commit` function:

```tsx
  const undo = () => {
    setHistory(current => {
      if (current.past.length === 0) return current
      const previous = current.past[current.past.length - 1]
      const past = current.past.slice(0, -1)
      const currentLayout = layoutRef.current
      layoutRef.current = previous
      onChange(previous)
      return {
        ...current,
        past,
        future: [currentLayout, ...current.future],
        lastMergeKey: null,
      }
    })
  }

  const redo = () => {
    setHistory(current => {
      if (current.future.length === 0) return current
      const next = current.future[0]
      const future = current.future.slice(1)
      const currentLayout = layoutRef.current
      layoutRef.current = next
      onChange(next)
      return {
        ...current,
        past: pushHistory(current.past, currentLayout),
        future,
        lastMergeKey: null,
      }
    })
  }
```

- [ ] **Step 2: Add keyboard shortcut effect after undo/redo**

Add this effect after the `redo` function:

```tsx
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableInput(event.target)) return
      const modifierPressed = event.ctrlKey || event.metaKey
      if (!modifierPressed) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })
```

- [ ] **Step 3: Run typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` passes.

## Task 3: Add Toolbar Buttons

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Add undo/redo buttons to the left toolbar**

In the left icon bar, insert these buttons after the eraser button and before the first divider:

```tsx
        <div className="w-6 border-b border-white/10" />
        <button
          type="button"
          onClick={undo}
          disabled={history.past.length === 0}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          title="撤销 Ctrl/Cmd+Z"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={history.future.length === 0}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          title="重做 Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y"
        >
          <Redo2 className="h-4 w-4" />
        </button>
```

The toolbar should keep one divider between tool modes and history actions, and another divider before add-block actions.

- [ ] **Step 2: Add missing `type="button"` to existing toolbar buttons touched nearby**

For the existing pointer, seat move, eraser, add grid, add arc, add standing, and auto-arrange buttons in the same toolbar, add `type="button"`. Example:

```tsx
        <button type="button" onClick={() => setToolMode('pointer')} className={`rounded-md p-1.5 transition-colors ${toolMode === 'pointer' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}><MousePointer2 className="h-4 w-4" /></button>
```

- [ ] **Step 3: Run typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` passes.

## Task 4: Wire Merge Keys For Continuous Canvas Operations

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`

- [ ] **Step 1: Update `updateBlock` to accept commit options**

Replace the current `updateBlock` function with:

```tsx
  const updateBlock = (blockKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['blocks']>[number]>, options?: CommitOptions) => {
    commit({ ...layout, blocks: blocks.map(block => block.blockKey === blockKey ? { ...block, ...updates } : block) }, options)
  }
```

- [ ] **Step 2: Update `updateStage` to accept commit options**

Replace the current `updateStage` function with:

```tsx
  const updateStage = (updates: Partial<SeatCraftLayoutDraft['stage']>, options?: CommitOptions) => {
    commit({ ...layout, stage: { ...layout.stage, ...updates } }, options)
  }
```

- [ ] **Step 3: Update `moveSeat` to pass a merge key**

Replace the final call in `moveSeat`:

```tsx
    updateBlock(blockKey, { overrides: nextOverrides })
```

with:

```tsx
    updateBlock(blockKey, { overrides: nextOverrides }, { mergeKey: `move:seat:${blockKey}:${rowNo}:${seatNo}` })
```

- [ ] **Step 4: Update block move, rotate, resize, stage move callbacks**

In the `SeatCanvas` props, update these handlers:

```tsx
          onBlockMove={(blockKey, x, y) => {
            if (toolMode === 'pointer') updateBlock(blockKey, { x, y }, { mergeKey: `move:block:${blockKey}` })
          }}
          onBlockMoveMultiple={(updates) => {
            if (toolMode === 'pointer') {
              const stageUpdate = updates.find(u => u.blockKey === 'STAGE')
              commit({
                ...layout,
                stage: stageUpdate ? { ...layout.stage, x: stageUpdate.x, y: stageUpdate.y } : layout.stage,
                blocks: blocks.map(b => {
                  const update = updates.find(u => u.blockKey === b.blockKey)
                  return update ? { ...b, x: update.x, y: update.y } : b
                })
              }, { mergeKey: 'move:blocks' })
            }
          }}
          onBlockRotate={(blockKey, rotation) => {
            if (toolMode === 'pointer') updateBlock(blockKey, { rotation }, { mergeKey: `rotate:block:${blockKey}` })
          }}
          onBlockResize={(blockKey, updates) => {
            if (toolMode === 'pointer') updateBlock(blockKey, updates, { mergeKey: `resize:block:${blockKey}` })
          }}
          onStageMove={(x, y) => {
            if (toolMode === 'pointer') updateStage({ x, y }, { mergeKey: 'move:stage' })
          }}
```

- [ ] **Step 5: Run typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` passes.

## Task 5: Verify Non-Continuous Operations Still Create Independent History Entries

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx` if needed.

- [ ] **Step 1: Inspect every direct `commit(` call**

Run from repo root:

```powershell
grep tool pattern: commit\(
path: frontend/src/components/seatcraft/SeatLayoutDesigner.tsx
```

Expected direct calls include add block, duplicate block, delete block, auto arrange, multi-move with merge key, and the commit function itself.

- [ ] **Step 2: Ensure non-continuous operations do not pass `mergeKey`**

Keep these operations without `mergeKey`:

```tsx
commit({ ...layout, sections: [], blocks: [...blocks, nextBlock], ticketGroups: [...] })
commit({ ...layout, blocks: [...blocks, copy], ticketGroups: [...] })
commit({ ...layout, blocks: nextBlocks, ticketGroups: ... })
commit(autoArrangeSeatLayout(layout))
```

Expected: each add, duplicate, delete, mirror, property edit, ticket group edit, hidden-seat toggle, and auto-arrange remains a separate undo step.

- [ ] **Step 3: Run typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` passes.

## Task 6: Manual Verification Checklist

**Files:**
- No source changes expected.

- [ ] **Step 1: Start or use the existing frontend dev server**

Run from `frontend` if the dev server is not already running:

```powershell
pnpm dev
```

Expected: Next.js dev server listens on `http://localhost:3000`.

- [ ] **Step 2: Verify add/undo/redo**

Open an activity or session SeatCraft editor.

Expected sequence:

```text
Click 添加方阵 -> one new block appears
Click 撤销 -> new block disappears
Click 重做 -> new block appears again
```

- [ ] **Step 3: Verify drag merge behavior**

Expected sequence:

```text
Drag a block for more than one second
Release pointer
Click 撤销 once
Block returns to the pre-drag position, not just the previous pointermove position
```

- [ ] **Step 4: Verify seat edit behavior**

Expected sequence:

```text
Switch to 隐藏座位
Click one visible seat -> seat becomes hidden/deleted visual state
Click 撤销 -> seat becomes visible again
Click 重做 -> seat becomes hidden again
Switch to 移动单座
Drag one visible seat
Click 撤销 -> seat returns to its original position
```

- [ ] **Step 5: Verify redo clears after new edit**

Expected sequence:

```text
Add block
Click 撤销
Move an existing block or add a different block
重做 button becomes disabled
```

- [ ] **Step 6: Verify shortcut guard in inputs**

Expected sequence:

```text
Focus a block name or number input in the right panel
Press Ctrl+Z
The input receives the browser/native undo behavior, and SeatCraft layout does not jump to previous editor state
```

## Task 7: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run frontend typecheck**

Run from `frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` passes.

- [ ] **Step 2: Review limited diff**

Run from repo root:

```powershell
git diff -- frontend/src/components/seatcraft/SeatLayoutDesigner.tsx docs/superpowers/specs/2026-05-24-seatcraft-undo-redo-design.md docs/superpowers/plans/2026-05-24-seatcraft-undo-redo.md
```

Expected: diff only contains the Undo/Redo spec, this plan, and focused `SeatLayoutDesigner.tsx` changes.

- [ ] **Step 3: Do not commit unless explicitly requested**

This workspace contains many unrelated uncommitted changes. If a commit is requested later, stage only these files:

```powershell
git add -- frontend/src/components/seatcraft/SeatLayoutDesigner.tsx docs/superpowers/specs/2026-05-24-seatcraft-undo-redo-design.md docs/superpowers/plans/2026-05-24-seatcraft-undo-redo.md
```

Expected: no unrelated dirty files are staged.

## Self-Review Notes

- Spec coverage: local history stack, keyboard shortcuts, toolbar buttons, merge keys, external owner reset, no backend/API changes, and verification are covered.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation instructions remain.
- Type consistency: `CommitOptions`, `HistoryState`, `ownerKeyForLayout`, `pushHistory`, `undo`, and `redo` are defined before use.
