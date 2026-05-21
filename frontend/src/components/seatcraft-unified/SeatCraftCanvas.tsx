'use client'

import { SeatCanvas } from '@/components/seatcraft/SeatCanvas'
import type { SeatCraftLayoutDraft, SeatCraftSection } from '@/components/seatcraft/types'
import { cn } from '@/lib/utils'
import type { SeatCraftCanvasProps, UnifiedSeatCraftLayout } from './types'

export function SeatCraftCanvas({
  layout,
  mode,
  selectedSeatIds = [],
  selectedSectionKeys = [],
  selectedBlockKeys = [],
  sectionSeats,
  focusTarget,
  onSeatClick,
  onSectionClick,
  onBlockClick,
  className,
}: SeatCraftCanvasProps) {
  const draft = toDraft(layout)
  const selectedSections = new Set(selectedSectionKeys)
  const selectedBlocks = new Set(selectedBlockKeys)
  const sections = draft.sections.map(section => selectedSections.has(section.sectionKey) ? { ...section, color: '#ff1268' } : section)
  const blocks = (draft.blocks ?? []).map(block => selectedBlocks.has(block.blockKey) ? { ...block, color: '#ff1268' } : block)
  const canClickSeats = mode === 'selection'
  const canClickRegions = mode === 'ticket'
  const blockClickHandler = canClickRegions ? onBlockClick : undefined

  return (
    <div className={cn('h-full min-h-[520px] w-full', className)}>
      <SeatCanvas
        sections={sections}
        blocks={blocks}
        stage={draft.stage}
        selectedSeatIds={selectedSeatIds.map(String)}
        sectionSeats={sectionSeats}
        isDesignMode={mode === 'design'}
        interactionMode={mode}
        activeSectionKey={selectedSectionKeys[0] ?? null}
        activeBlockKey={selectedBlockKeys[0] ?? null}
        stageTitle={draft.stage.title}
        focusTarget={focusTarget}
        onSeatClick={canClickSeats ? onSeatClick : undefined}
        onSectionClick={canClickRegions ? (section: SeatCraftSection) => onSectionClick?.(section.sectionKey) : undefined}
        onBlockClick={blockClickHandler ? block => blockClickHandler(block.blockKey) : undefined}
      />
    </div>
  )
}

function toDraft(layout: UnifiedSeatCraftLayout | SeatCraftLayoutDraft): SeatCraftLayoutDraft {
  if ('source' in layout) {
    return {
      id: layout.id,
      venueId: layout.venueId ?? null,
      activityId: layout.activityId ?? null,
      sessionId: layout.sessionId ?? null,
      name: layout.name,
      templateType: layout.templateType,
      stage: layout.stage,
      canvasWidth: layout.canvasWidth,
      canvasHeight: layout.canvasHeight,
      sections: layout.sections.map(section => ({
        id: String(section.id ?? section.sectionKey),
        sectionKey: section.sectionKey,
        name: section.name,
        rows: section.rows,
        cols: section.cols,
        x: section.x,
        y: section.y,
        color: section.color,
        type: section.type,
        layout: section.layout,
        radius: section.radius,
        arcSpan: section.arcSpan,
        rotation: section.rotation,
        primeRowStart: section.primeRowStart,
        primeRowEnd: section.primeRowEnd,
        primeColStart: section.primeColStart,
        primeColEnd: section.primeColEnd,
        ticketTypeId: section.ticketTypeId,
      })),
      blocks: layout.blocks,
      overrides: [],
      ticketGroups: layout.ticketGroups,
    }
  }
  return layout
}
