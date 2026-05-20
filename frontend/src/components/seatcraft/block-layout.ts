import type { SeatBlockDraft, SeatCraftLayoutDraft, SeatCraftSeat, SeatOverrideDraft, SeatStatus } from './types'
import type { SeatCraftLayoutVO, SeatCraftSectionVO } from '@/types/api'

const DEFAULT_ROW_SPACING = 24
const DEFAULT_SEAT_SPACING = 24
const DEFAULT_INNER_RADIUS = 80
const DEFAULT_ARC_START = 0
const DEFAULT_ARC_END = 180
const SNAP_DISTANCE = 8

export type SeatCraftLayoutPayload = Omit<SeatCraftLayoutVO, 'blocks' | 'overrides' | 'ticketGroups' | 'blockLayout'> & {
  id: number
  sections: SeatCraftSectionVO[]
  blockLayout?: {
    name: string
    canvasWidth: number
    canvasHeight: number
    blocks: Array<Omit<SeatBlockDraft, 'overrides'>>
    overrides: SeatOverrideDraft[]
    ticketGroups: NonNullable<SeatCraftLayoutDraft['ticketGroups']>
  }
  blocks?: never
  overrides?: never
  ticketGroups?: never
}

export function buildSeatsForBlock(block: SeatBlockDraft, selectedSeatIds: string[] = []): SeatCraftSeat[] {
  if (block.blockType === 'standingBlock') {
    return []
  }
  const overrides = toOverrideMap(block.overrides ?? [])
  if (block.blockType === 'arcBlock') {
    return buildArcSeats(block, overrides, selectedSeatIds)
  }
  return buildGridSeats(block, overrides, selectedSeatIds)
}

export function cloneBlock(block: SeatBlockDraft, nextId: string, nextKey: string): SeatBlockDraft {
  return {
    ...block,
    id: nextId,
    blockKey: nextKey,
    name: `${block.name} 副本`,
    x: block.x + 24,
    y: block.y + 24,
    overrides: block.overrides?.map(override => ({ ...override, blockKey: nextKey })),
  }
}

export function mirrorBlockHorizontally(block: SeatBlockDraft, canvasWidth: number): SeatBlockDraft {
  return {
    ...block,
    x: canvasWidth - block.x,
    rotation: -(block.rotation || 0),
  }
}

export function snapBlockPosition(
  position: { x: number; y: number },
  context: { canvasWidth: number; canvasHeight: number; blocks: SeatBlockDraft[] },
) {
  const snapTargets = [
    { x: context.canvasWidth / 2, y: context.canvasHeight / 2 },
    ...context.blocks.map(block => ({ x: block.x, y: block.y })),
  ]
  return snapTargets.reduce((current, target) => ({
    x: Math.abs(current.x - target.x) <= SNAP_DISTANCE ? target.x : current.x,
    y: Math.abs(current.y - target.y) <= SNAP_DISTANCE ? target.y : current.y,
  }), position)
}

export function toSeatCraftLayoutPayload(layout: SeatCraftLayoutDraft): SeatCraftLayoutPayload {
  const blockLayout = (layout.blocks?.length ?? 0) > 0 ? {
    name: layout.name,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    blocks: layout.blocks?.map(({ overrides: _overrides, ...block }) => block) ?? [],
    overrides: layout.overrides ?? layout.blocks?.flatMap(block => block.overrides ?? []) ?? [],
    ticketGroups: layout.ticketGroups ?? [],
  } : undefined

  return {
    id: layout.id ?? 0,
    venueId: layout.venueId ?? null,
    activityId: layout.activityId ?? null,
    sessionId: layout.sessionId ?? null,
    name: layout.name,
    templateType: layout.templateType,
    stageTitle: layout.stage.title,
    stageX: layout.stage.x,
    stageY: layout.stage.y,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    sections: layout.sections.map(section => ({
      id: Number(section.id),
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
      ticketTypeId: section.ticketTypeId ?? null,
    })),
    blockLayout,
  }
}

function buildGridSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[]) {
  const seats: SeatCraftSeat[] = []
  const rows = positive(block.rows, 0)
  const cols = positive(block.cols, 0)
  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const seatSpacing = positive(block.seatSpacing, DEFAULT_SEAT_SPACING)
  for (let row = 1; row <= rows; row += 1) {
    for (let seat = 1; seat <= cols; seat += 1) {
      const override = overrides.get(key(row, seat))
      if (isExcluded(override)) continue
      seats.push(buildSeat(block, row, seat, block.x + (seat - 1) * seatSpacing, block.y + (row - 1) * rowSpacing, override, selectedSeatIds))
    }
  }
  return seats
}

function buildArcSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[]) {
  const seats: SeatCraftSeat[] = []
  const rows = positive(block.rows, 0)
  const seatsPerRow = positive(block.seatsPerRow, 0)
  const innerRadius = positive(block.innerRadius, DEFAULT_INNER_RADIUS)
  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const startAngle = block.arcStartAngle ?? DEFAULT_ARC_START
  const endAngle = block.arcEndAngle ?? DEFAULT_ARC_END
  for (let row = 1; row <= rows; row += 1) {
    const radius = innerRadius + (row - 1) * rowSpacing
    for (let seat = 1; seat <= seatsPerRow; seat += 1) {
      const override = overrides.get(key(row, seat))
      if (isExcluded(override)) continue
      const t = seatsPerRow === 1 ? 0.5 : (seat - 1) / (seatsPerRow - 1)
      const angle = startAngle + (endAngle - startAngle) * t + (block.rotation || 0)
      const radians = angle * Math.PI / 180
      seats.push(buildSeat(block, row, seat, block.x + radius * Math.cos(radians), block.y + radius * Math.sin(radians), override, selectedSeatIds, angle))
    }
  }
  return seats
}

function buildSeat(
  block: SeatBlockDraft,
  rowNo: number,
  seatNo: number,
  x: number,
  y: number,
  override: SeatOverrideDraft | undefined,
  selectedSeatIds: string[],
  angle = block.rotation || 0,
): SeatCraftSeat {
  const id = `${block.blockKey}-${rowNo}-${seatNo}`
  return {
    id,
    row: rowNo - 1,
    col: seatNo - 1,
    x: x + (override?.dx ?? 0),
    y: y + (override?.dy ?? 0),
    angle,
    status: selectedSeatIds.includes(id) ? 'selected' : 'available' as SeatStatus,
    price: 0,
    sectionKey: block.blockKey,
    sectionName: block.name,
    label: override?.customLabel?.trim() || `${rowNo}排${seatNo}座`,
  }
}

function toOverrideMap(overrides: SeatOverrideDraft[]) {
  return overrides.reduce((acc, override) => acc.set(key(override.rowNo, override.seatNo), override), new Map<string, SeatOverrideDraft>())
}

function isExcluded(override?: SeatOverrideDraft) {
  return override?.status === 'hidden' || override?.status === 'deleted'
}

function key(rowNo: number, seatNo: number) {
  return `${rowNo}:${seatNo}`
}

function positive(value: number | null | undefined, fallback: number) {
  return value != null && value > 0 ? value : fallback
}
