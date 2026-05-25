'use client'

import { useEffect, useRef, useState } from 'react'
import { Grid3X3, LayoutGrid, MousePointer2, Move, RotateCcw, Users, EyeOff, Undo2, Redo2 } from 'lucide-react'
import { SeatCanvas } from './SeatCanvas'
import { SeatLayoutControls } from './SeatLayoutControls'
import { autoArrangeSeatLayout, buildSeatsForBlock, cloneBlock, mirrorBlockHorizontally, updateSeatCraftPrimaryBinding } from './block-layout'
import { applyHistoryAction, commitHistory, createSeatCraftHistory, resetHistoryForOwner, type CommitOptions, type SeatCraftHistoryState } from './history'
import { canEditSeatPosition } from './seat-selection'
import { makeBlockKey, makeDefaultStage, type ActiveSeatDetails, type ActiveSeatKey, type SeatBlockType, type SeatCanvasToolMode, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'

function nextBlockId(blocks: NonNullable<SeatCraftLayoutDraft['blocks']>) {
  const max = blocks.reduce((acc, block) => {
    const current = Number(block.id)
    return Number.isFinite(current) ? Math.max(acc, current) : acc
  }, 0)
  return String(max + 1)
}

function nextBlockKey(blocks: NonNullable<SeatCraftLayoutDraft['blocks']>) {
  const keys = new Set(blocks.map(block => block.blockKey))
  let index = blocks.length
  let key = makeBlockKey(index)
  while (keys.has(key)) {
    index += 1
    key = makeBlockKey(index)
  }
  return key
}

function makeCopyBlockKey(blockKey: string, blocks: NonNullable<SeatCraftLayoutDraft['blocks']>) {
  const keys = new Set(blocks.map(block => block.blockKey))
  let index = 1
  let key = `${blockKey}-copy`
  while (keys.has(key)) {
    index += 1
    key = `${blockKey}-copy-${index}`
  }
  return key
}

function isEditableInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

export function SeatLayoutDesigner({ layout, onChange, activeBlockKeys: controlledActiveBlockKeys, onActiveBlockKeysChange, sessionSeats = [] }: SeatLayoutDesignerProps) {
  const [internalActiveBlockKeys, setInternalActiveBlockKeys] = useState<string[]>(layout.blocks?.[0] ? [layout.blocks[0].blockKey] : [])
  const [toolMode, setToolMode] = useState<SeatCanvasToolMode>('pointer')
  const [activeSeatKey, setActiveSeatKey] = useState<ActiveSeatKey | null>(null)
  const [history, setHistory] = useState(() => createSeatCraftHistory(layout))
  const layoutRef = useRef(layout)
  const historyRef = useRef(history)
  const blocks = layout.blocks ?? []

  const activeBlockKeys = controlledActiveBlockKeys ?? internalActiveBlockKeys
  const setActiveBlockKeys = (keys: string[]) => {
    if (controlledActiveBlockKeys === undefined) {
      setInternalActiveBlockKeys(keys)
    }
    onActiveBlockKeysChange?.(keys)
  }
  const selectBlocks = (keys: string[]) => {
    setActiveBlockKeys(keys)
    if (!activeSeatKey || (keys.length === 1 && keys[0] === activeSeatKey.blockKey)) return
    setActiveSeatKey(null)
  }

  const activeBlockKey = activeBlockKeys.length === 1 ? activeBlockKeys[0] : null
  const canEditBlockBinding = activeBlockKeys.length === 1
  const statusSeatsByBlock = new Map(
    sessionSeats
      .filter(seat => seat.seatBlockId != null)
      .map(seat => [`${seat.seatBlockId}-${seat.generatedRowNo ?? seat.rowNo}-${seat.generatedSeatNo ?? seat.seatNo}`, seat]),
  )
  const statusSeatsByGroup = new Map(
    sessionSeats
      .filter(seat => seat.ticketGroupKey)
      .map(seat => [`${seat.ticketGroupKey}-${seat.generatedRowNo ?? seat.rowNo}-${seat.generatedSeatNo ?? seat.seatNo}`, seat]),
  )
  const sectionSeats = Object.fromEntries(blocks.map(block => [
    block.blockKey,
    buildSeatsForBlock(block, [], true).map(seat => {
      const rowNo = seat.row + 1
      const seatNo = seat.col + 1
      const source = statusSeatsByBlock.get(`${block.id}-${rowNo}-${seatNo}`)
        ?? statusSeatsByGroup.get(`${block.ticketGroupKey}-${rowNo}-${seatNo}`)
        ?? statusSeatsByGroup.get(`${block.blockKey}-${rowNo}-${seatNo}`)
      const occupied = source != null && (source.status === 2 || source.status === 3 || source.orderId != null)
      return source ? { ...seat, sessionSeatId: source.id, status: occupied ? 'occupied' : seat.status } : seat
    }),
  ]))
  const activeSeatDetails: ActiveSeatDetails | null = (() => {
    if (!activeSeatKey) return null
    const block = blocks.find(item => item.blockKey === activeSeatKey.blockKey)
    if (!block) return null
    const seat = sectionSeats[activeSeatKey.blockKey]?.find(item => item.row + 1 === activeSeatKey.rowNo && item.col + 1 === activeSeatKey.seatNo)
    if (!seat) return null
    return { key: activeSeatKey, blockName: block.name, seat }
  })()

  useEffect(() => {
    layoutRef.current = layout
    const nextHistory = resetHistoryForOwner(historyRef.current, layout)
    historyRef.current = nextHistory
    setHistory(nextHistory)
  }, [layout])

  useEffect(() => {
    if (activeBlockKeys.length === 0 && blocks.length > 0) {
      setActiveBlockKeys([blocks[0].blockKey])
      return
    }
    const validKeys = activeBlockKeys.filter(key => key === 'STAGE' || blocks.some(b => b.blockKey === key))
    if (validKeys.length !== activeBlockKeys.length) {
      setActiveBlockKeys(validKeys.length > 0 ? validKeys : (blocks.length > 0 ? [blocks[0].blockKey] : []))
    }
  }, [activeBlockKeys, blocks])

  useEffect(() => {
    if (activeSeatKey && !activeSeatDetails) {
      setActiveSeatKey(null)
    }
  }, [activeSeatKey, activeSeatDetails])

  useEffect(() => {
    if (!activeSeatKey) return
    if (activeBlockKeys.length === 1 && activeBlockKeys[0] === activeSeatKey.blockKey) return
    setActiveSeatKey(null)
  }, [activeBlockKeys, activeSeatKey])

  const commit = (next: SeatCraftLayoutDraft, options: CommitOptions = {}) => {
    const currentLayout = layoutRef.current
    const nextHistory = commitHistory(historyRef.current, currentLayout, options)
    historyRef.current = nextHistory
    setHistory(nextHistory)
    layoutRef.current = next
    onChange(next)
  }

  const applyHistory = (action: 'undo' | 'redo') => {
    const currentHistory = historyRef.current
    const result = applyHistoryAction(currentHistory, layoutRef.current, action)
    if (result.history === currentHistory) return
    historyRef.current = result.history
    setHistory(result.history)
    layoutRef.current = result.layout
    onChange(result.layout)
  }

  const undo = () => applyHistory('undo')

  const redo = () => applyHistory('redo')

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

  const updateBlock = (blockKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['blocks']>[number]>, options?: CommitOptions) => {
    commit({ ...layout, blocks: blocks.map(block => block.blockKey === blockKey ? { ...block, ...updates } : block) }, options)
  }

  const addBlock = (blockType: SeatBlockType = 'gridBlock') => {
    const blockId = nextBlockId(blocks)
    const blockKey = nextBlockKey(blocks)
    const groupKey = `group-${blockKey}`
    const nextBlock = createBlock(blockType, blockId, blockKey, groupKey, blocks.length)
    commit({
      ...layout,
      sections: [],
      blocks: [...blocks, nextBlock],
      ticketGroups: [...(layout.ticketGroups ?? []), {
        groupKey,
        name: `${nextBlock.name} 票档`,
        defaultPrice: null,
        activityPrice: null,
        sourceBlockKeys: [blockKey],
        sort: blocks.length,
      }],
    })
    selectBlocks([blockKey])
  }

  const duplicateBlock = (blockKey: string) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block) return
    const nextId = nextBlockId(blocks)
    const nextKey = makeCopyBlockKey(block.blockKey, blocks)
    const groupKey = `group-${nextKey}`
    const copy = { ...cloneBlock(block, nextId, nextKey), ticketGroupKey: groupKey, sort: blocks.length }
    commit({
      ...layout,
      blocks: [...blocks, copy],
      ticketGroups: [...(layout.ticketGroups ?? []), { groupKey, name: `${copy.name} 票档`, defaultPrice: null, activityPrice: null, sourceBlockKeys: [nextKey], sort: blocks.length }],
    })
    selectBlocks([nextKey])
  }

  const deleteBlock = (blockKey: string) => {
    const deleting = blocks.find(block => block.blockKey === blockKey)
    const nextBlocks = blocks.filter(block => block.blockKey !== blockKey)
    commit({
      ...layout,
      blocks: nextBlocks,
      ticketGroups: deleting ? (layout.ticketGroups ?? []).filter(group => group.groupKey !== deleting.ticketGroupKey) : layout.ticketGroups,
    })
    if (activeBlockKeys.includes(blockKey)) {
      setActiveBlockKeys(nextBlocks.length > 0 ? [nextBlocks[0].blockKey] : [])
    }
    if (activeSeatKey?.blockKey === blockKey) {
      setActiveSeatKey(null)
    }
  }

  const updateStage = (updates: Partial<SeatCraftLayoutDraft['stage']>, options?: CommitOptions) => {
    commit({ ...layout, stage: { ...layout.stage, ...updates } }, options)
  }

  const updateTicketGroup = (groupKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['ticketGroups']>[number]>) => {
    commit({ ...layout, ticketGroups: (layout.ticketGroups ?? []).map(group => group.groupKey === groupKey ? { ...group, ...updates } : group) })
  }

  const updateBlockPrimaryBinding = (blockKey: string, groupKey: string) => {
    commit(updateSeatCraftPrimaryBinding(layout, blockKey, groupKey), { mergeKey: `bind:block:${blockKey}` })
  }

  const moveSeat = (blockKey: string, rowNo: number, seatNo: number, x: number, y: number, baseX: number, baseY: number, options?: CommitOptions) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block || block.blockType === 'standingBlock') return
    const existingOverrides = block.overrides ?? []
    const overrideIndex = existingOverrides.findIndex(override => override.rowNo === rowNo && override.seatNo === seatNo)
    const dx = x - baseX
    const dy = y - baseY
    const nextOverrides = [...existingOverrides]
    if (overrideIndex >= 0) {
      const current = nextOverrides[overrideIndex]
      if (current.status === 'hidden' || current.status === 'deleted') return
      nextOverrides[overrideIndex] = { ...current, blockKey, rowNo, seatNo, status: 'visible', dx, dy }
    } else {
      nextOverrides.push({ blockKey, rowNo, seatNo, status: 'visible', dx, dy })
    }
    updateBlock(blockKey, { overrides: nextOverrides }, options ?? { mergeKey: `move:seat:${blockKey}:${rowNo}:${seatNo}` })
  }

  const updateSeatPosition = (seatKey: ActiveSeatKey, x: number, y: number) => {
    const details = activeSeatDetails
    if (!details || details.key.blockKey !== seatKey.blockKey || details.key.rowNo !== seatKey.rowNo || details.key.seatNo !== seatKey.seatNo) return
    if (!canEditSeatPosition(details.seat)) return
    moveSeat(seatKey.blockKey, seatKey.rowNo, seatKey.seatNo, x, y, details.seat.baseX ?? 0, details.seat.baseY ?? 0, {
      mergeKey: `edit:seat-position:${seatKey.blockKey}:${seatKey.rowNo}:${seatKey.seatNo}`,
    })
  }

  const movePolygonPoint = (blockKey: string, pointIndex: number, x: number, y: number) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block || block.blockType !== 'polygonBlock') return
    const polygonPoints = [...(block.polygonPoints ?? [])]
    if (!polygonPoints[pointIndex]) return
    polygonPoints[pointIndex] = { x, y }
    updateBlock(blockKey, { polygonPoints }, { mergeKey: `resize:polygon:${blockKey}:${pointIndex}` })
  }

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[760px] w-full overflow-hidden rounded-xl border border-white/5 bg-[#141414] text-zinc-300 shadow-2xl font-sans">

      {/* Left Icon Bar */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-white/5 bg-[#1a1a1a] py-4">
        <button type="button" onClick={() => setToolMode('pointer')} className={`rounded-md p-1.5 transition-colors ${toolMode === 'pointer' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}><MousePointer2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setToolMode('seatMove')} className={`rounded-md p-1.5 transition-colors ${toolMode === 'seatMove' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`} title="移动单座"><Move className="h-4 w-4" /></button>
        <button type="button" onClick={() => setToolMode('eraser')} className={`rounded-md p-1.5 transition-colors ${toolMode === 'eraser' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`} title="隐藏座位（承重柱等）"><EyeOff className="h-4 w-4" /></button>
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
        <div className="w-6 border-b border-white/10" />
        <button type="button" onClick={() => addBlock('gridBlock')} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" title="添加方阵"><LayoutGrid className="h-4 w-4" /></button>
        <button type="button" onClick={() => addBlock('arcBlock')} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" title="添加扇形"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" onClick={() => addBlock('polygonBlock')} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" title="添加多边形区"><Grid3X3 className="h-4 w-4" /></button>
        <button type="button" onClick={() => addBlock('standingBlock')} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" title="添加站区"><Users className="h-4 w-4" /></button>
        <div className="flex-1" />
        <button type="button" onClick={() => commit(autoArrangeSeatLayout(layout))} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"><Grid3X3 className="h-4 w-4" /></button>
      </div>

      {/* Layers Panel */}
      <div className="flex w-56 shrink-0 flex-col border-r border-white/5 bg-[#1a1a1a]">
        <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
          <span className="text-xs font-semibold text-white">图层面板</span>
        </div>
        <div className="border-b border-white/5 p-3">
          <div className="mb-1 text-[10px] text-zinc-500">项目：[万象] {layout.name}</div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] text-zinc-500">区域列表</span>
            <button className="text-xs text-zinc-500 hover:text-white">+</button>
          </div>
          {blocks.map(block => (
            <button
              key={block.blockKey}
              onClick={() => selectBlocks([block.blockKey])}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                activeBlockKeys.includes(block.blockKey) ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="h-3 w-3 opacity-50" />
              <span className="truncate">{block.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 bg-[#0a0a0a] overflow-hidden">
        <SeatCanvas
          sections={[]}
          blocks={blocks}
          stage={layout.stage}
          selectedSeatIds={[]}
          sectionSeats={sectionSeats}
          isDesignMode
          toolMode={toolMode}
          activeBlockKeys={activeBlockKeys}
          activeSeatKey={activeSeatKey}
          onBlockSelect={selectBlocks}
          onSeatSelect={seatKey => {
            setActiveSeatKey(seatKey)
            if (seatKey?.blockKey) setActiveBlockKeys([seatKey.blockKey])
          }}
          stageTitle={layout.stage.title}
          onSeatClick={seat => {
            if (toolMode === 'eraser') {
              const block = blocks.find(b => b.blockKey === seat.sectionKey)
              if (!block) return
              const rowNo = seat.row + 1
              const seatNo = seat.col + 1
              const existingOverrides = block.overrides ?? []
              const overrideIndex = existingOverrides.findIndex(o => o.rowNo === rowNo && o.seatNo === seatNo)
              let nextOverrides = [...existingOverrides]
              if (overrideIndex >= 0) {
                const current = nextOverrides[overrideIndex]
                if (current.status === 'hidden' || current.status === 'deleted') {
                  nextOverrides.splice(overrideIndex, 1) // Remove override to show seat again
                } else {
                  nextOverrides[overrideIndex] = { ...current, status: 'hidden' }
                }
              } else {
                nextOverrides.push({ blockKey: block.blockKey, rowNo, seatNo, status: 'hidden' })
              }
              if (activeSeatKey?.blockKey === block.blockKey && activeSeatKey.rowNo === rowNo && activeSeatKey.seatNo === seatNo) {
                setActiveSeatKey(null)
              }
              updateBlock(block.blockKey, { overrides: nextOverrides })
            }
          }}
          onSeatMove={moveSeat}
          onPolygonPointMove={movePolygonPoint}
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
        />
      </div>

      {/* Right Properties Panel */}
      <div className="flex w-72 shrink-0 flex-col border-l border-white/5 bg-[#1a1a1a] overflow-y-auto custom-scrollbar">
        <SeatLayoutControls
          layout={{ ...layout, sections: [], blocks }}
          activeSectionKey={null}
          activeBlockKey={activeBlockKey}
          canEditBlockBinding={canEditBlockBinding}
          onSelectSection={() => undefined}
          onSelectBlock={key => selectBlocks(key ? [key] : [])}
          onUpdateSection={() => undefined}
          onUpdateBlock={updateBlock}
          onUpdateBlockPrimaryBinding={updateBlockPrimaryBinding}
          onAddSection={() => undefined}
          onAddBlock={addBlock}
          onDuplicateSection={() => undefined}
          onDuplicateBlock={duplicateBlock}
          onMirrorBlock={blockKey => {
            const block = blocks.find(item => item.blockKey === blockKey)
            if (block) updateBlock(blockKey, mirrorBlockHorizontally(block, layout.canvasWidth))
          }}
          onDeleteSection={() => undefined}
          onDeleteBlock={deleteBlock}
          onUpdateTicketGroup={updateTicketGroup}
          onUpdateStage={updateStage}
          onAutoArrange={() => commit(autoArrangeSeatLayout(layout))}
          activeSeat={activeSeatDetails}
          onSelectSeat={setActiveSeatKey}
          onUpdateSeatPosition={updateSeatPosition}
        />
      </div>
    </div>
  )
}

function createBlock(blockType: SeatBlockType, id: string, blockKey: string, ticketGroupKey: string, index: number) {
  const base = {
    id,
    blockKey,
    ticketGroupKey,
    x: 420,
    y: 260,
    rotation: 0,
    scale: 1,
    rowSpacing: 24,
    seatSpacing: 24,
    color: '#34d399',
    sort: index,
    overrides: [],
  }
  if (blockType === 'arcBlock') {
    return { ...base, name: `剧场扇形 ${index + 1}`, blockType, rows: 8, cols: null, seatsPerRow: null, innerRadius: 110, arcStartAngle: -60, arcEndAngle: 60, width: null, height: null, capacity: null }
  }
  if (blockType === 'standingBlock') {
    return { ...base, name: `站区 ${index + 1}`, blockType, rows: null, cols: null, seatsPerRow: null, innerRadius: null, arcStartAngle: null, arcEndAngle: null, width: 180, height: 90, capacity: 500 }
  }
  if (blockType === 'polygonBlock') {
    return {
      ...base,
      name: `多边形区 ${index + 1}`,
      blockType,
      rows: null,
      cols: null,
      seatsPerRow: null,
      innerRadius: null,
      arcStartAngle: null,
      arcEndAngle: null,
      width: null,
      height: null,
      capacity: null,
      polygonPoints: [
        { x: 0, y: 0 },
        { x: 220, y: 20 },
        { x: 180, y: 140 },
        { x: 20, y: 120 },
      ],
    }
  }
  return { ...base, name: `方阵 ${index + 1}`, blockType, rows: 8, cols: 12, seatsPerRow: null, innerRadius: null, arcStartAngle: null, arcEndAngle: null, width: null, height: null, capacity: null }
}

export function createEmptySeatLayoutDraft(): SeatCraftLayoutDraft {
  return {
    id: null,
    venueId: null,
    activityId: null,
    sessionId: null,
    name: 'SeatCraft 布局',
    templateType: 'concert',
    stage: makeDefaultStage('舞台'),
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [],
    overrides: [],
    ticketGroups: [],
  }
}
