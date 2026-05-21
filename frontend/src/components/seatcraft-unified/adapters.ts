import type { SeatCraftLayoutVO, SeatMapResponse, SessionSeatVO } from '@/types/api'
import { buildSeatsForBlock } from '@/components/seatcraft/block-layout'
import { toSeatCraftLayoutDraft as toLegacySeatCraftLayoutDraft, type SeatBlockDraft, type SeatCraftLayoutDraft, type SeatCraftSeat } from '@/components/seatcraft/types'
import type { UnifiedSeatCraftLayout, UnifiedSeatCraftSeat, UnifiedSeatCraftSelectionModel, ZoomTarget } from './types'

export function toUnifiedSeatCraftLayout(layout: SeatCraftLayoutVO, options: { includeBlocks?: boolean } = {}): UnifiedSeatCraftLayout {
  const draft = toLegacySeatCraftLayoutDraft(layout)
  return {
    id: layout.id ?? null,
    venueId: layout.venueId ?? null,
    activityId: layout.activityId ?? null,
    sessionId: layout.sessionId ?? null,
    name: layout.name,
    templateType: layout.templateType,
    stage: draft.stage,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    sections: [],
    blocks: options.includeBlocks === false ? [] : draft.blocks ?? [],
    ticketGroups: layout.blockLayout?.ticketGroups ?? layout.ticketGroups ?? [],
    source: layout,
  }
}

export function toSeatCraftLayoutDraft(layout: SeatCraftLayoutVO): SeatCraftLayoutDraft {
  return toLegacySeatCraftLayoutDraft(layout)
}

export function toSeatCraftSelectionModel(response: SeatMapResponse): UnifiedSeatCraftSelectionModel {
  const layout = response.layout ? toUnifiedSeatCraftLayout(response.layout) : null
  const blocks = layout?.blocks ?? []
  const seatsByBlockPosition = response.seats.reduce<Record<string, SessionSeatVO>>((acc, seat) => {
    const blockKey = findBlockKeyBySeat(blocks, seat)
    const rowNo = seat.generatedRowNo ?? seat.rowNo
    const seatNo = seat.generatedSeatNo ?? seat.seatNo
    if (!blockKey) return acc
    acc[`${blockKey}-${rowNo}-${seatNo}`] = seat
    return acc
  }, {})

  const seatsBySectionKey: Record<string, UnifiedSeatCraftSeat[]> = {}

  if (layout) {
    for (const block of blocks) {
      const builtSeats = buildSeatsForBlock(block)
      seatsBySectionKey[block.blockKey] = builtSeats.map((seat) => {
        const source = seatsByBlockPosition[`${block.blockKey}-${seat.row + 1}-${seat.col + 1}`]
        return buildUnifiedSeat(seat, source, null, response.ticketTypeId)
      })
    }
  }

  const layoutSeats = Object.values(seatsBySectionKey).flat()
  const seats = layoutSeats

  return {
    sessionId: response.sessionId,
    ticketTypeId: response.ticketTypeId,
    ticketTypeName: response.ticketTypeName,
    price: response.price,
    stageLabel: response.stageLabel,
    layout,
    seats,
    seatsBySectionKey,
    availableSeatIds: seats.filter(seat => seat.sessionSeatId != null && seat.status === 'available').map(seat => seat.sessionSeatId as number),
  }
}

export function buildZoomTargetFromTicketGroup(layout: SeatCraftLayoutVO, ticketTypeId: number): ZoomTarget | null {
  const draft = toLegacySeatCraftLayoutDraft(layout)
  const groupKeys = new Set((draft.ticketGroups ?? [])
    .filter(group => group.name === String(ticketTypeId) || group.groupKey === String(ticketTypeId) || group.sourceBlockKeys.length > 0)
    .flatMap(group => group.sourceBlockKeys))
  const targets = (draft.blocks ?? [])
    .filter(block => groupKeys.size === 0 || groupKeys.has(block.blockKey))
    .map(buildBlockBBox)

  if (targets.length === 0) return null

  const minX = Math.min(...targets.map(target => target.x - target.width / 2))
  const minY = Math.min(...targets.map(target => target.y - target.height / 2))
  const maxX = Math.max(...targets.map(target => target.x + target.width / 2))
  const maxY = Math.max(...targets.map(target => target.y + target.height / 2))
  const width = maxX - minX
  const height = maxY - minY

  return {
    x: minX + width / 2,
    y: minY + height / 2,
    width,
    height,
    scale: targets.length === 1 ? 1.8 : 1.4,
    sectionKeys: targets.flatMap(target => target.sectionKeys ?? []),
  }
}

function buildUnifiedSeat(
  seat: Omit<UnifiedSeatCraftSeat, 'layoutSectionId' | 'ticketTypeId' | 'source'>,
  source: SessionSeatVO | undefined,
  layoutSectionId: number | null,
  ticketTypeId: number,
): UnifiedSeatCraftSeat {
  const sessionSeatId = source?.id ?? seat.sessionSeatId
  const isAvailable = source?.status === 1 && (source.ticketTypeId == null || source.ticketTypeId === ticketTypeId)
  return {
    ...seat,
    id: sessionSeatId != null ? String(sessionSeatId) : seat.id,
    sessionSeatId,
    status: source ? (isAvailable ? 'available' : 'occupied') : 'occupied',
    layoutSectionId,
    ticketTypeId: source?.ticketTypeId ?? null,
    source: source ?? null,
  }
}

function findBlockKeyBySeat(blocks: SeatBlockDraft[], seat: SessionSeatVO) {
  if (seat.ticketGroupKey) {
    const block = blocks.find(item => item.ticketGroupKey === seat.ticketGroupKey)
    if (block) return block.blockKey
  }
  if (seat.seatBlockId != null) {
    const block = blocks.find(item => Number(item.id) === seat.seatBlockId)
    if (block) return block.blockKey
  }
  return null
}

function buildBlockBBox(block: SeatBlockDraft): ZoomTarget {
  if (block.blockType === 'standingBlock') {
    const width = block.width ?? 180
    const height = block.height ?? 90
    return { x: block.x + width / 2, y: block.y + height / 2, width, height, sectionKeys: [block.blockKey] }
  }
  const seats = buildSeatsForBlock(block)
  return buildSeatsBBox(seats, block.blockKey)
}

function buildSeatsBBox(seats: SeatCraftSeat[], key: string): ZoomTarget {
  if (seats.length === 0) return { x: 0, y: 0, width: 240, height: 180, sectionKeys: [key] }
  const minX = Math.min(...seats.map(seat => seat.x))
  const minY = Math.min(...seats.map(seat => seat.y))
  const maxX = Math.max(...seats.map(seat => seat.x))
  const maxY = Math.max(...seats.map(seat => seat.y))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: Math.max(80, maxX - minX), height: Math.max(80, maxY - minY), sectionKeys: [key] }
}
