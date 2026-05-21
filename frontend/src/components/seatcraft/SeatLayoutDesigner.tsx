'use client'

import { useEffect, useState } from 'react'
import { SeatCanvas } from './SeatCanvas'
import { SeatLayoutControls } from './SeatLayoutControls'
import { autoArrangeSeatLayout, cloneBlock, mirrorBlockHorizontally } from './block-layout'
import { makeBlockKey, makeDefaultStage, type SeatBlockType, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'

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

export function SeatLayoutDesigner({ layout, onChange }: SeatLayoutDesignerProps) {
  const [activeBlockKey, setActiveBlockKey] = useState<string | null>(layout.blocks?.[0]?.blockKey ?? null)
  const blocks = layout.blocks ?? []

  useEffect(() => {
    if (activeBlockKey == null) {
      setActiveBlockKey(blocks[0]?.blockKey ?? null)
      return
    }
    if (!blocks.some(block => block.blockKey === activeBlockKey)) {
      setActiveBlockKey(blocks[0]?.blockKey ?? null)
    }
  }, [activeBlockKey, blocks])

  const commit = (next: SeatCraftLayoutDraft) => onChange(next)

  const updateBlock = (blockKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['blocks']>[number]>) => {
    commit({ ...layout, blocks: blocks.map(block => block.blockKey === blockKey ? { ...block, ...updates } : block) })
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
    setActiveBlockKey(blockKey)
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
    setActiveBlockKey(nextKey)
  }

  const deleteBlock = (blockKey: string) => {
    const deleting = blocks.find(block => block.blockKey === blockKey)
    const nextBlocks = blocks.filter(block => block.blockKey !== blockKey)
    commit({
      ...layout,
      blocks: nextBlocks,
      ticketGroups: deleting ? (layout.ticketGroups ?? []).filter(group => group.groupKey !== deleting.ticketGroupKey) : layout.ticketGroups,
    })
    if (activeBlockKey === blockKey) setActiveBlockKey(nextBlocks[0]?.blockKey ?? null)
  }

  const updateStage = (updates: Partial<SeatCraftLayoutDraft['stage']>) => {
    commit({ ...layout, stage: { ...layout.stage, ...updates } })
  }

  const updateTicketGroup = (groupKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['ticketGroups']>[number]>) => {
    commit({ ...layout, ticketGroups: (layout.ticketGroups ?? []).map(group => group.groupKey === groupKey ? { ...group, ...updates } : group) })
  }

  return (
    <div className="flex h-full min-h-[720px] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="min-w-0 flex-1 p-4">
        <SeatCanvas
          sections={[]}
          blocks={blocks}
          stage={layout.stage}
          selectedSeatIds={[]}
          isDesignMode
          activeBlockKey={activeBlockKey}
          stageTitle={layout.stage.title}
          onBlockClick={block => setActiveBlockKey(block.blockKey)}
          onBlockMove={(blockKey, x, y) => updateBlock(blockKey, { x, y })}
          onStageMove={(x, y) => updateStage({ x, y })}
        />
      </div>
      <SeatLayoutControls
        layout={{ ...layout, sections: [], blocks }}
        activeSectionKey={null}
        activeBlockKey={activeBlockKey}
        onSelectSection={() => undefined}
        onSelectBlock={setActiveBlockKey}
        onUpdateSection={() => undefined}
        onUpdateBlock={updateBlock}
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
      />
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
    return { ...base, name: `剧场扇形 ${index + 1}`, blockType, rows: 8, cols: null, seatsPerRow: 16, innerRadius: 110, arcStartAngle: -60, arcEndAngle: 60, width: null, height: null, capacity: null }
  }
  if (blockType === 'standingBlock') {
    return { ...base, name: `站区 ${index + 1}`, blockType, rows: null, cols: null, seatsPerRow: null, innerRadius: null, arcStartAngle: null, arcEndAngle: null, width: 180, height: 90, capacity: 500 }
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
