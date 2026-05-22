import type { SeatCraftLayoutVO, SeatCraftSectionVO, SessionSeatVO, TicketGroupVO } from '@/types/api'
import type { ReactNode } from 'react'
import type { SeatBlockDraft, SeatCraftLayoutDraft, SeatCraftSeat, SeatCraftStage, SeatCraftZoomTarget, SeatStatus } from '@/components/seatcraft/types'

export type SelectionMode = 'design' | 'selection' | 'ticket'

export type ZoomTarget = SeatCraftZoomTarget

export interface UnifiedSeatCraftSeat extends Omit<SeatCraftSeat, 'status'> {
  status: SeatStatus
  layoutSectionId?: number | null
  ticketTypeId?: number | null
  source?: SessionSeatVO | null
}

export interface UnifiedSeatCraftSection {
  id: number | null
  sectionKey: string
  name: string
  rows: number
  cols: number
  x: number
  y: number
  color: string
  type: SeatCraftSectionVO['type']
  layout: SeatCraftSectionVO['layout']
  radius?: number | null
  arcSpan?: number | null
  rotation?: number | null
  primeRowStart?: number | null
  primeRowEnd?: number | null
  primeColStart?: number | null
  primeColEnd?: number | null
  seatCount?: number | null
  ticketTypeId?: number | null
  price?: number | null
  bbox: ZoomTarget
}

export interface UnifiedSeatCraftLayout {
  id: number | null
  venueId?: number | null
  activityId?: number | null
  sessionId?: number | null
  name: string
  templateType: SeatCraftLayoutVO['templateType']
  stage: SeatCraftStage
  canvasWidth: number
  canvasHeight: number
  sections: UnifiedSeatCraftSection[]
  blocks: SeatBlockDraft[]
  ticketGroups: TicketGroupVO[]
  source: SeatCraftLayoutVO
}

export interface UnifiedSeatCraftSelectionModel {
  sessionId: number
  ticketTypeId: number
  ticketTypeName: string
  price: number
  stageLabel: string
  layout: UnifiedSeatCraftLayout | null
  seats: UnifiedSeatCraftSeat[]
  seatsBySectionKey: Record<string, UnifiedSeatCraftSeat[]>
  availableSeatIds: number[]
}

export interface SeatCraftCanvasProps {
  layout: UnifiedSeatCraftLayout | SeatCraftLayoutDraft
  mode: SelectionMode
  selectedSeatIds?: Array<string | number>
  selectedSectionKeys?: string[]
  selectedBlockKeys?: string[]
  sectionSeats?: Record<string, SeatCraftSeat[]>
  focusTarget?: ZoomTarget | null
  onSeatClick?: (seat: SeatCraftSeat) => void
  onSectionClick?: (sectionKey: string) => void
  onBlockClick?: (blockKey: string) => void
  className?: string
}

export interface SeatCraftControlsProps {
  mode: SelectionMode
  onModeChange: (mode: SelectionMode) => void
  summary?: ReactNode
  children?: ReactNode
}

export interface SeatCraftSelectorProps {
  selectionModel: UnifiedSeatCraftSelectionModel
  selectedSeatIds: number[]
  onChange: (seatIds: number[]) => void
  maxSelectable?: number
  focusTarget?: ZoomTarget | null
}

export interface SeatCraftTicketEditorProps {
  layout: SeatCraftLayoutVO
  ticketDrafts: SeatCraftSectionVO[]
  selectedSectionIds: number[]
  onSelectedSectionIdsChange: (sectionIds: number[]) => void
  ticketName: string
  ticketPrice: string
  onTicketNameChange: (value: string) => void
  onTicketPriceChange: (value: string) => void
  estimatedSeatCount: number
  onSubmit: () => void | Promise<void>
  allowSubmitWithoutSelection?: boolean
  submitLabel?: string
}
