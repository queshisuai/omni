import type { SeatCraftLayoutVO, SessionSeatVO } from '@/types/api'

export type SeatStatus = 'available' | 'reserved' | 'selected' | 'occupied'
export type SectionType = 'core' | 'stand' | 'zone'
export type SectionLayout = 'grid' | 'curved'

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
  layoutMode?: 'unified' | 'per_session' | null
  name: string
  templateType: 'concert' | 'cinema' | 'custom'
  stage: SeatCraftStage
  canvasWidth: number
  canvasHeight: number
  sections: SeatCraftSection[]
}

export interface SeatCanvasProps {
  sections: SeatCraftSection[]
  stage: SeatCraftStage
  selectedSeatIds?: string[]
  sectionSeats?: Record<string, SeatCraftSeat[]>
  isDesignMode: boolean
  onSeatClick?: (seat: SeatCraftSeat) => void
  onSectionMove?: (sectionKey: string, x: number, y: number) => void
  onStageMove?: (x: number, y: number) => void
  activeSectionKey?: string | null
  stageTitle?: string
}

export interface SeatLayoutControlsProps {
  layout: SeatCraftLayoutDraft
  activeSectionKey: string | null
  onSelectSection: (sectionKey: string | null) => void
  onUpdateSection: (sectionKey: string, updates: Partial<SeatCraftSection>) => void
  onAddSection: () => void
  onDuplicateSection: (sectionKey: string) => void
  onDeleteSection: (sectionKey: string) => void
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

export function toSeatCraftLayoutDraft(layout: SeatCraftLayoutVO): SeatCraftLayoutDraft {
  return {
    id: layout.id,
    venueId: layout.venueId ?? null,
    activityId: layout.activityId ?? null,
    sessionId: layout.sessionId ?? null,
    layoutMode: layout.layoutMode ?? null,
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
  }
}
