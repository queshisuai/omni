import type { SeatCraftLayoutVO, SeatMapResponse, SessionSeatVO } from '@/types/api'
import { buildSeatsForSection } from '@/components/seatcraft/layout'
import { toSeatCraftLayoutDraft as toLegacySeatCraftLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { UnifiedSeatCraftLayout, UnifiedSeatCraftSeat, UnifiedSeatCraftSelectionModel, ZoomTarget } from './types'

const SECTION_SEAT_SPACING = 16
const SECTION_PADDING_X = 24
const SECTION_HEADER_HEIGHT = 35
const SECTION_PADDING_BOTTOM = 10

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
    sections: layout.sections.map(section => ({
      id: section.id ?? null,
      sectionKey: section.sectionKey,
      name: section.name,
      rows: section.rows,
      cols: section.cols,
      x: section.x,
      y: section.y,
      color: section.color,
      type: section.type,
      layout: section.layout,
      radius: section.radius ?? null,
      arcSpan: section.arcSpan ?? null,
      rotation: section.rotation ?? null,
      primeRowStart: section.primeRowStart ?? null,
      primeRowEnd: section.primeRowEnd ?? null,
      primeColStart: section.primeColStart ?? null,
      primeColEnd: section.primeColEnd ?? null,
      seatCount: section.seatCount ?? null,
      ticketTypeId: section.ticketTypeId ?? null,
      price: section.price ?? null,
      bbox: buildSectionBBox(section),
    })),
    blocks: options.includeBlocks === false ? [] : draft.blocks ?? [],
    ticketGroups: layout.blockLayout?.ticketGroups ?? layout.ticketGroups ?? [],
    source: layout,
  }
}

export function toSeatCraftLayoutDraft(layout: SeatCraftLayoutVO): SeatCraftLayoutDraft {
  return toLegacySeatCraftLayoutDraft(layout)
}

export function toSeatCraftSelectionModel(response: SeatMapResponse): UnifiedSeatCraftSelectionModel {
  const layout = response.layout ? toUnifiedSeatCraftLayout(response.layout, { includeBlocks: false }) : null
  const sectionById = new Map((response.layout?.sections ?? []).map(section => [section.id, section]))
  const seatsByPosition = response.seats.reduce<Record<string, SessionSeatVO>>((acc, seat) => {
    if (seat.layoutSectionId == null) return acc
    acc[`${seat.layoutSectionId}-${seat.rowNo}-${seat.seatNo}`] = seat
    return acc
  }, {})

  const seatsBySectionKey: Record<string, UnifiedSeatCraftSeat[]> = {}

  if (response.layout) {
    for (const section of response.layout.sections) {
      const builtSeats = buildSeatsForSection({
        id: String(section.id),
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
      })

      seatsBySectionKey[section.sectionKey] = builtSeats.map((seat) => {
        const source = seatsByPosition[`${section.id}-${seat.row + 1}-${seat.col + 1}`]
        return buildUnifiedSeat(seat, source, section.id, response.ticketTypeId)
      })
    }
  }

  const layoutSeats = Object.values(seatsBySectionKey).flat()
  const fallbackSeats = layoutSeats.length > 0 ? [] : response.seats.map((seat) => {
    const section = sectionById.get(seat.layoutSectionId ?? -1)
    return buildUnifiedSeat({
      id: String(seat.id),
      sessionSeatId: seat.id,
      row: seat.rowNo - 1,
      col: seat.seatNo - 1,
      x: 0,
      y: 0,
      angle: 0,
      status: seat.status === 1 ? 'available' : 'occupied',
      sectionKey: section?.sectionKey ?? String(seat.layoutSectionId ?? seat.areaId),
      sectionName: section?.name ?? `分区 ${seat.areaId}`,
      label: seat.seatLabel,
    }, seat, seat.layoutSectionId ?? null, response.ticketTypeId)
  })

  const seats = layoutSeats.length > 0 ? layoutSeats : fallbackSeats

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
  // C 端当前只支持基于 section.ticketTypeId 聚焦；block/ticketGroup 尚无真实座位映射时不构造误导性目标。
  const targets = layout.sections
    .filter(section => section.ticketTypeId === ticketTypeId)
    .map(buildSectionBBox)

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
    sectionKeys: layout.sections.filter(section => section.ticketTypeId === ticketTypeId).map(section => section.sectionKey),
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

function buildSectionBBox(section: { sectionKey: string; x: number; y: number; rows: number; cols: number; layout: string; radius?: number | null; arcSpan?: number | null }): ZoomTarget {
  if (section.layout === 'curved') {
    const radius = section.radius ?? 200
    const span = section.arcSpan ?? 120
    const width = Math.max(section.cols * SECTION_SEAT_SPACING + SECTION_PADDING_X, radius * 2 * Math.sin((span / 2) * Math.PI / 180))
    const height = Math.max(section.rows * SECTION_SEAT_SPACING + SECTION_HEADER_HEIGHT, radius + section.rows * SECTION_SEAT_SPACING)
    return { x: section.x, y: section.y + height / 3, width, height, sectionKeys: [section.sectionKey] }
  }

  return {
    x: section.x,
    y: section.y + (section.rows * SECTION_SEAT_SPACING - SECTION_HEADER_HEIGHT) / 2,
    width: section.cols * SECTION_SEAT_SPACING + SECTION_PADDING_X,
    height: section.rows * SECTION_SEAT_SPACING + SECTION_HEADER_HEIGHT + SECTION_PADDING_BOTTOM,
    sectionKeys: [section.sectionKey],
  }
}
