import type { SeatCraftLayoutVO, SessionSeatVO } from '@/types/api'

export type SeatStatus = 'available' | 'reserved' | 'selected' | 'occupied'
export type SectionType = 'core' | 'stand' | 'zone'
export type SectionLayout = 'grid' | 'curved'
export type SeatBlockType = 'gridBlock' | 'arcBlock' | 'standingBlock'
export type SeatOverrideStatus = 'visible' | 'hidden' | 'deleted'
export type SeatCanvasInteractionMode = 'design' | 'selection' | 'ticket'

export interface SeatCraftZoomTarget {
  x: number
  y: number
  width: number
  height: number
  scale?: number
  sectionKeys?: string[]
}

export interface SeatCraftSeat {
  id: string
  sessionSeatId?: number
  row: number
  col: number
  x: number
  y: number
  angle: number
  status: SeatStatus
  price?: number
  sectionKey: string
  sectionName: string
  label: string
}

export interface SeatCraftSection {
  id: string
  sectionKey: string
  name: string
  rows: number
  cols: number
  x: number
  y: number
  color: string
  type: SectionType
  layout: SectionLayout
  radius?: number | null
  arcSpan?: number | null
  rotation?: number | null
  primeRowStart?: number | null
  primeRowEnd?: number | null
  primeColStart?: number | null
  primeColEnd?: number | null
  ticketTypeId?: number | null
}

export interface SeatOverrideDraft {
  blockKey: string
  rowNo: number
  seatNo: number
  status: SeatOverrideStatus
  dx?: number | null
  dy?: number | null
  customLabel?: string | null
}

export interface SeatBlockDraft {
  id: string
  blockKey: string
  name: string
  blockType: SeatBlockType
  ticketGroupKey: string
  x: number
  y: number
  rotation: number
  scale: number
  rows?: number | null
  cols?: number | null
  seatsPerRow?: number | null
  rowSpacing?: number | null
  seatSpacing?: number | null
  innerRadius?: number | null
  arcStartAngle?: number | null
  arcEndAngle?: number | null
  width?: number | null
  height?: number | null
  capacity?: number | null
  color: string
  sort: number
  overrides?: SeatOverrideDraft[]
}

export interface TicketGroupDraft {
  groupKey: string
  name: string
  defaultPrice?: number | null
  activityPrice?: number | null
  sourceBlockKeys: string[]
  sort: number
}

export interface SeatCraftStage {
  title: string
  x: number
  y: number
}

export interface SeatCraftLayoutDraft {
  id?: number | null
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
}

export interface SeatCanvasProps {
  sections: SeatCraftSection[]
  blocks?: SeatBlockDraft[]
  stage: SeatCraftStage
  selectedSeatIds?: string[]
  sectionSeats?: Record<string, SeatCraftSeat[]>
  isDesignMode: boolean
  interactionMode?: SeatCanvasInteractionMode
  onSeatClick?: (seat: SeatCraftSeat) => void
  onSectionClick?: (section: SeatCraftSection) => void
  onBlockClick?: (block: SeatBlockDraft) => void
  onSectionMove?: (sectionKey: string, x: number, y: number) => void
  onBlockMove?: (blockKey: string, x: number, y: number) => void
  onStageMove?: (x: number, y: number) => void
  activeSectionKey?: string | null
  activeBlockKey?: string | null
  focusTarget?: SeatCraftZoomTarget | null
  stageTitle?: string
}

export interface SeatLayoutControlsProps {
  layout: SeatCraftLayoutDraft
  activeSectionKey: string | null
  activeBlockKey?: string | null
  onSelectSection: (sectionKey: string | null) => void
  onSelectBlock?: (blockKey: string | null) => void
  onUpdateSection: (sectionKey: string, updates: Partial<SeatCraftSection>) => void
  onUpdateBlock?: (blockKey: string, updates: Partial<SeatBlockDraft>) => void
  onAddSection: () => void
  onAddBlock?: (blockType?: SeatBlockType) => void
  onDuplicateSection: (sectionKey: string) => void
  onDuplicateBlock?: (blockKey: string) => void
  onMirrorBlock?: (blockKey: string) => void
  onDeleteSection: (sectionKey: string) => void
  onDeleteBlock?: (blockKey: string) => void
  onUpdateTicketGroup?: (groupKey: string, updates: Partial<TicketGroupDraft>) => void
  onUpdateStage: (updates: Partial<SeatCraftStage>) => void
}

export interface SeatLayoutDesignerProps {
  layout: SeatCraftLayoutDraft
  onChange: (layout: SeatCraftLayoutDraft) => void
}

export interface SeatSelectionMapProps {
  layout: SeatCraftLayoutVO
  seats: SessionSeatVO[]
  ticketTypeId?: number | null
  selectedSeatIds: number[]
  onChange: (seatIds: number[]) => void
  maxSelectable?: number
  focusTarget?: SeatCraftZoomTarget | null
}

export function makeDefaultStage(title = '舞台'): SeatCraftStage {
  return {
    title,
    x: 0,
    y: 0,
  }
}

export function makeSectionKey(index: number) {
  return `section-${index + 1}`
}

export function makeBlockKey(index: number) {
  return `block-${index + 1}`
}

export function toSeatCraftLayoutDraft(layout: SeatCraftLayoutVO): SeatCraftLayoutDraft {
  return {
    id: layout.id,
    venueId: layout.venueId ?? null,
    activityId: layout.activityId ?? null,
    sessionId: layout.sessionId ?? null,
    name: layout.name,
    templateType: layout.templateType,
    stage: {
      title: layout.stageTitle,
      x: layout.stageX,
      y: layout.stageY,
    },
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    sections: layout.sections.map((section, index) => ({
      id: String(section.id ?? index + 1),
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
    blocks: (layout.blockLayout?.blocks ?? layout.blocks)?.map(block => ({
      id: String(block.id),
      blockKey: block.blockKey,
      name: block.name,
      blockType: block.blockType,
      ticketGroupKey: block.ticketGroupKey,
      x: block.x,
      y: block.y,
      rotation: block.rotation,
      scale: block.scale,
      rows: block.rows,
      cols: block.cols,
      seatsPerRow: block.seatsPerRow,
      rowSpacing: block.rowSpacing,
      seatSpacing: block.seatSpacing,
      innerRadius: block.innerRadius,
      arcStartAngle: block.arcStartAngle,
      arcEndAngle: block.arcEndAngle,
      width: block.width,
      height: block.height,
      capacity: block.capacity,
      color: block.color,
      sort: block.sort,
      overrides: (layout.blockLayout?.overrides ?? layout.overrides)?.filter(override => override.blockKey === block.blockKey),
    })) ?? [],
    overrides: layout.blockLayout?.overrides ?? layout.overrides ?? [],
    ticketGroups: layout.blockLayout?.ticketGroups ?? layout.ticketGroups ?? [],
  }
}
