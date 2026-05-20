'use client'

import { useEffect, useMemo, useState } from 'react'
import { SeatCanvas } from './SeatCanvas'
import { SeatLayoutControls } from './SeatLayoutControls'
import { cloneBlock, mirrorBlockHorizontally, snapBlockPosition } from './block-layout'
import { cloneSection } from './layout'
import { makeBlockKey, makeDefaultStage, makeSectionKey, type SeatBlockType, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'

function nextSectionId(sections: SeatCraftLayoutDraft['sections']) {
  const max = sections.reduce((acc, section) => {
    const current = Number(section.id)
    return Number.isFinite(current) ? Math.max(acc, current) : acc
  }, 0)
  return String(max + 1)
}

function nextSectionKey(sections: SeatCraftLayoutDraft['sections']) {
  const keys = new Set(sections.map(section => section.sectionKey))
  let index = sections.length
  let key = makeSectionKey(index)
  while (keys.has(key)) {
    index += 1
    key = makeSectionKey(index)
  }
  return key
}

function makeCopySectionKey(sectionKey: string, sections: SeatCraftLayoutDraft['sections']) {
  const keys = new Set(sections.map(section => section.sectionKey))
  let index = 1
  let key = `${sectionKey}-copy`
  while (keys.has(key)) {
    index += 1
    key = `${sectionKey}-copy-${index}`
  }
  return key
}

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
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(layout.sections[0]?.sectionKey ?? null)
  const [activeBlockKey, setActiveBlockKey] = useState<string | null>(layout.blocks?.[0]?.blockKey ?? null)

  useEffect(() => {
    if (activeSectionKey == null) {
      setActiveSectionKey(layout.sections[0]?.sectionKey ?? null)
      return
    }
    const stillExists = layout.sections.some(section => section.sectionKey === activeSectionKey)
    if (!stillExists) {
      setActiveSectionKey(layout.sections[0]?.sectionKey ?? null)
    }
  }, [activeSectionKey, layout.sections])

  const draft = useMemo(() => layout, [layout])
  const blocks = draft.blocks ?? []

  const commit = (next: SeatCraftLayoutDraft) => onChange(next)

  const updateSection = (sectionKey: string, updates: Partial<SeatCraftLayoutDraft['sections'][number]>) => {
    commit({
      ...draft,
      sections: draft.sections.map(section => section.sectionKey === sectionKey ? { ...section, ...updates } : section),
    })
  }

  const updateBlock = (blockKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['blocks']>[number]>) => {
    commit({
      ...draft,
      blocks: blocks.map(block => block.blockKey === blockKey ? { ...block, ...updates } : block),
    })
  }

  const addSection = () => {
    const sectionId = nextSectionId(draft.sections)
    const sectionKey = nextSectionKey(draft.sections)
    commit({
      ...draft,
      sections: [...draft.sections, {
        id: sectionId,
        sectionKey,
        name: `分区 ${draft.sections.length + 1}`,
        rows: 8,
        cols: 16,
        x: 80 + draft.sections.length * 24,
        y: 160 + draft.sections.length * 24,
        color: '#34d399',
        type: 'core',
        layout: 'grid',
      }],
    })
    setActiveSectionKey(sectionKey)
  }

  const addBlock = (blockType: SeatBlockType = 'gridBlock') => {
    const blockId = nextBlockId(blocks)
    const blockKey = nextBlockKey(blocks)
    const baseIndex = blocks.length
    commit({
      ...draft,
      blocks: [...blocks, {
        id: blockId,
        blockKey,
        name: blockType === 'standingBlock' ? `站区 ${baseIndex + 1}` : `座位块 ${baseIndex + 1}`,
        blockType,
        ticketGroupKey: `group-${baseIndex + 1}`,
        x: 140 + baseIndex * 28,
        y: 180 + baseIndex * 28,
        rotation: 0,
        scale: 1,
        rows: blockType === 'standingBlock' ? null : 8,
        cols: blockType === 'gridBlock' ? 12 : null,
        seatsPerRow: blockType === 'arcBlock' ? 14 : null,
        rowSpacing: 24,
        seatSpacing: 24,
        innerRadius: blockType === 'arcBlock' ? 120 : null,
        arcStartAngle: blockType === 'arcBlock' ? 15 : null,
        arcEndAngle: blockType === 'arcBlock' ? 165 : null,
        width: blockType === 'standingBlock' ? 180 : null,
        height: blockType === 'standingBlock' ? 90 : null,
        capacity: blockType === 'standingBlock' ? 500 : null,
        color: '#34d399',
        sort: baseIndex,
        overrides: [],
      }],
      ticketGroups: [...(draft.ticketGroups ?? []), {
        groupKey: `group-${baseIndex + 1}`,
        name: blockType === 'standingBlock' ? `站区票档 ${baseIndex + 1}` : `座位票档 ${baseIndex + 1}`,
        defaultPrice: null,
        activityPrice: null,
        sourceBlockKeys: [blockKey],
        sort: baseIndex,
      }],
    })
    setActiveBlockKey(blockKey)
    setActiveSectionKey(null)
  }

  const duplicateSection = (sectionKey: string) => {
    const section = draft.sections.find(item => item.sectionKey === sectionKey)
    if (!section) return
    const nextId = nextSectionId(draft.sections)
    const nextKey = makeCopySectionKey(section.sectionKey, draft.sections)
    commit({
      ...draft,
      sections: [...draft.sections, cloneSection(section, nextId, nextKey)],
    })
    setActiveSectionKey(nextKey)
  }

  const duplicateBlock = (blockKey: string) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block) return
    const nextId = nextBlockId(blocks)
    const nextKey = makeCopyBlockKey(block.blockKey, blocks)
    commit({
      ...draft,
      blocks: [...blocks, cloneBlock(block, nextId, nextKey)],
      ticketGroups: (draft.ticketGroups ?? []).map(group => group.groupKey === block.ticketGroupKey
        ? { ...group, sourceBlockKeys: Array.from(new Set([...group.sourceBlockKeys, nextKey])) }
        : group),
    })
    setActiveBlockKey(nextKey)
    setActiveSectionKey(null)
  }

  const mirrorBlock = (blockKey: string) => {
    const block = blocks.find(item => item.blockKey === blockKey)
    if (!block) return
    updateBlock(blockKey, mirrorBlockHorizontally(block, draft.canvasWidth))
  }

  const deleteSection = (sectionKey: string) => {
    const sections = draft.sections.filter(section => section.sectionKey !== sectionKey)
    commit({ ...draft, sections })
    if (activeSectionKey === sectionKey) {
      setActiveSectionKey(sections[0]?.sectionKey ?? null)
    }
  }

  const deleteBlock = (blockKey: string) => {
    const deleting = blocks.find(block => block.blockKey === blockKey)
    const nextBlocks = blocks.filter(block => block.blockKey !== blockKey)
    commit({
      ...draft,
      blocks: nextBlocks,
      ticketGroups: deleting ? (draft.ticketGroups ?? [])
        .map(group => group.groupKey === deleting.ticketGroupKey
          ? { ...group, sourceBlockKeys: group.sourceBlockKeys.filter(key => key !== blockKey) }
          : group)
        .filter(group => group.sourceBlockKeys.length > 0) : draft.ticketGroups,
    })
    if (activeBlockKey === blockKey) {
      setActiveBlockKey(nextBlocks[0]?.blockKey ?? null)
    }
  }

  const updateStage = (updates: Partial<SeatCraftLayoutDraft['stage']>) => {
    commit({ ...draft, stage: { ...draft.stage, ...updates } })
  }

  const updateTicketGroup = (groupKey: string, updates: Partial<NonNullable<SeatCraftLayoutDraft['ticketGroups']>[number]>) => {
    commit({
      ...draft,
      ticketGroups: (draft.ticketGroups ?? []).map(group => group.groupKey === groupKey ? { ...group, ...updates } : group),
    })
  }

  return (
    <div className="flex h-full min-h-[720px] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="min-w-0 flex-1 p-4">
        <SeatCanvas
          sections={draft.sections}
          blocks={blocks}
          stage={draft.stage}
          selectedSeatIds={[]}
          isDesignMode
          activeSectionKey={activeSectionKey}
          activeBlockKey={activeBlockKey}
          stageTitle={draft.stage.title}
          onSectionMove={(sectionKey, x, y) => updateSection(sectionKey, { x, y })}
          onBlockMove={(blockKey, x, y) => {
            const snapped = snapBlockPosition({ x, y }, { canvasWidth: draft.canvasWidth, canvasHeight: draft.canvasHeight, blocks: blocks.filter(block => block.blockKey !== blockKey) })
            updateBlock(blockKey, snapped)
          }}
          onStageMove={(x, y) => updateStage({ x, y })}
          onSeatClick={undefined}
        />
      </div>
      <SeatLayoutControls
        layout={draft}
        activeSectionKey={activeSectionKey}
        activeBlockKey={activeBlockKey}
        onSelectSection={setActiveSectionKey}
        onSelectBlock={(blockKey) => { setActiveBlockKey(blockKey); setActiveSectionKey(null) }}
        onUpdateSection={updateSection}
        onUpdateBlock={updateBlock}
        onAddSection={addSection}
        onAddBlock={addBlock}
        onDuplicateSection={duplicateSection}
        onDuplicateBlock={duplicateBlock}
        onMirrorBlock={mirrorBlock}
        onDeleteSection={deleteSection}
        onDeleteBlock={deleteBlock}
        onUpdateTicketGroup={updateTicketGroup}
        onUpdateStage={updateStage}
      />
    </div>
  )
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
