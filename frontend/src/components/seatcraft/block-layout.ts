import type { SeatBlockDraft, SeatCraftBinding, SeatCraftLayoutDraft, SeatCraftPoint, SeatCraftSeat, SeatOverrideDraft, SeatStatus, TicketGroupDraft } from './types'
import type { SeatCraftLayoutVO, SeatCraftSectionVO, SeatCraftVersionedBlockRequest, SeatCraftVersionedLayoutRequest } from '@/types/api'

const DEFAULT_ROW_SPACING = 24
const DEFAULT_SEAT_SPACING = 24
const DEFAULT_INNER_RADIUS = 80
const DEFAULT_ARC_START = 0
const DEFAULT_ARC_END = 180
const SNAP_DISTANCE = 8
const ARRANGE_START_X = 120
const ARRANGE_START_Y = 180
const ARRANGE_GAP_X = 300
const ARRANGE_GAP_Y = 220
const ARRANGE_COLUMNS = 3
const POLYGON_EPSILON = 0.000001

export type SeatCraftLayoutPayload = Omit<SeatCraftLayoutVO, 'blocks' | 'overrides' | 'ticketGroups' | 'bindings' | 'blockLayout'> & {
  id: number
  sections: SeatCraftSectionVO[]
  blockLayout?: {
    name: string
    canvasWidth: number
    canvasHeight: number
    blocks: Array<Omit<SeatBlockDraft, 'overrides'>>
    overrides: SeatOverrideDraft[]
    ticketGroups: NonNullable<SeatCraftLayoutDraft['ticketGroups']>
    bindings: SeatCraftBinding[]
  }
  blocks?: never
  overrides?: never
  ticketGroups?: never
  bindings?: never
}

export function buildSeatsForBlock(block: SeatBlockDraft, selectedSeatIds: string[] = [], includeExcluded = false): SeatCraftSeat[] {
  if (block.blockType === 'standingBlock') {
    return []
  }
  const overrides = toOverrideMap(block.overrides ?? [])
  if (block.blockType === 'arcBlock') {
    return buildArcSeats(block, overrides, selectedSeatIds, includeExcluded)
  }
  if (block.blockType === 'polygonBlock') {
    return buildPolygonSeats(block, overrides, selectedSeatIds, includeExcluded)
  }
  return buildGridSeats(block, overrides, selectedSeatIds, includeExcluded)
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

export function autoArrangeSeatLayout(layout: SeatCraftLayoutDraft): SeatCraftLayoutDraft {
  const blocks = layout.blocks ?? []
  return {
    ...layout,
    blocks: blocks.map((block, index) => ({
      ...block,
      x: ARRANGE_START_X + (index % ARRANGE_COLUMNS) * ARRANGE_GAP_X,
      y: ARRANGE_START_Y + Math.floor(index / ARRANGE_COLUMNS) * ARRANGE_GAP_Y,
    })),
  }
}

export function buildSeatCraftBindings(layout: SeatCraftLayoutDraft): SeatCraftBinding[] {
  const blocks = layout.blocks ?? []
  const ticketGroups = layout.ticketGroups ?? []
  const blockMap = new Map(blocks.map(block => [block.blockKey, block]))
  const groupKeys = new Set(ticketGroups.map(group => group.groupKey))
  const explicitBindings = layout.bindings ?? []
  const candidates: SeatCraftBinding[] = [
    ...explicitBindings,
    ...blocks
      .filter(block => block.ticketGroupKey)
      .map(block => ({ blockKey: block.blockKey, groupKey: block.ticketGroupKey, bindingRole: 'primary' })),
    ...ticketGroups.flatMap(group => (group.sourceBlockKeys ?? []).map(blockKey => ({ blockKey, groupKey: group.groupKey, bindingRole: 'primary' }))),
  ]
  const seen = new Set<string>()
  const results: SeatCraftBinding[] = []

  for (const binding of candidates) {
    const blockKey = binding.blockKey?.trim()
    const groupKey = binding.groupKey?.trim()
    const role = binding.bindingRole?.trim() || 'primary'
    if (!blockKey || !groupKey || !blockMap.has(blockKey) || !groupKeys.has(groupKey)) continue

    const dedupeKey = `${blockKey}:${role}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    results.push({
      blockKey,
      groupKey,
      bindingRole: role,
      sort: binding.sort ?? blockMap.get(blockKey)?.sort ?? 0,
    })
  }

  return results
}

export function getSeatCraftPrimaryBindingValue(layout: SeatCraftLayoutDraft, blockKey: string | null | undefined, canEditBlockBinding = true) {
  if (!canEditBlockBinding || !blockKey) return ''
  const ticketGroups = layout.ticketGroups ?? []
  const groupKeys = new Set(ticketGroups.map(group => group.groupKey))
  const block = (layout.blocks ?? []).find(item => item.blockKey === blockKey)
  if (!block) return ''
  const primaryGroupKey = buildSeatCraftBindings(layout).find(binding => binding.blockKey === block.blockKey && (binding.bindingRole ?? 'primary') === 'primary')?.groupKey ?? block.ticketGroupKey
  return primaryGroupKey && groupKeys.has(primaryGroupKey) ? primaryGroupKey : ''
}

export function updateSeatCraftPrimaryBinding(layout: SeatCraftLayoutDraft, blockKey: string, groupKey: string): SeatCraftLayoutDraft {
  const nextBlockKey = blockKey.trim()
  const nextGroupKey = groupKey.trim()
  const blocks = layout.blocks ?? []
  const ticketGroups = layout.ticketGroups ?? []
  const block = blocks.find(item => item.blockKey === nextBlockKey)
  if (!block || (nextGroupKey && !ticketGroups.some(group => group.groupKey === nextGroupKey))) return layout

  const nextBindings = (layout.bindings ?? []).filter(binding => {
    const role = binding.bindingRole?.trim() || 'primary'
    return role !== 'primary' || binding.blockKey !== nextBlockKey
  })
  if (nextGroupKey) {
    nextBindings.push({
      blockKey: nextBlockKey,
      groupKey: nextGroupKey,
      bindingRole: 'primary',
      sort: block.sort ?? 0,
    })
  }

  return {
    ...layout,
    blocks: blocks.map(item => item.blockKey === nextBlockKey ? { ...item, ticketGroupKey: nextGroupKey } : item),
    ticketGroups: ticketGroups.map(group => {
      const sourceBlockKeys = (group.sourceBlockKeys ?? []).filter(sourceBlockKey => sourceBlockKey !== nextBlockKey)
      if (group.groupKey === nextGroupKey && !sourceBlockKeys.includes(nextBlockKey)) {
        return { ...group, sourceBlockKeys: [...sourceBlockKeys, nextBlockKey] }
      }
      return { ...group, sourceBlockKeys }
    }),
    bindings: nextBindings,
  }
}

export function toSeatCraftLayoutPayload(layout: SeatCraftLayoutDraft): SeatCraftLayoutPayload {
  const bindings = buildSeatCraftBindings(layout)
  const blockLayout = (layout.blocks?.length ?? 0) > 0 ? {
    name: layout.name,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    blocks: buildPayloadBlocks(layout.blocks ?? [], bindings),
    overrides: layout.overrides ?? layout.blocks?.flatMap(block => block.overrides ?? []) ?? [],
    ticketGroups: buildPayloadTicketGroups(layout.ticketGroups ?? [], layout.blocks ?? [], bindings),
    bindings,
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

export function toSeatCraftVersionedLayoutPayload(layout: SeatCraftLayoutDraft): SeatCraftVersionedLayoutRequest {
  const blockLayout = toSeatCraftLayoutPayload(layout).blockLayout
  return {
    versionId: layout.versionId ?? null,
    versionNo: layout.versionNo ?? null,
    versionStatus: layout.versionStatus ?? null,
    name: layout.name,
    templateType: layout.templateType,
    stageTitle: layout.stage.title,
    stageX: layout.stage.x,
    stageY: layout.stage.y,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    blocks: buildVersionedPayloadBlocks(blockLayout?.blocks ?? []),
    overrides: blockLayout?.overrides ?? layout.overrides ?? [],
    ticketGroups: blockLayout?.ticketGroups ?? [],
    bindings: blockLayout?.bindings ?? buildSeatCraftBindings(layout),
  }
}

export function mergePersistedSeatCraftLayout(currentLayout: SeatCraftLayoutDraft, savedSnapshot: SeatCraftLayoutDraft, persistedLayout: SeatCraftLayoutDraft): SeatCraftLayoutDraft {
  return {
    ...currentLayout,
    versionId: persistedLayout.versionId ?? currentLayout.versionId ?? savedSnapshot.versionId ?? null,
    versionNo: persistedLayout.versionNo ?? currentLayout.versionNo ?? savedSnapshot.versionNo ?? null,
    versionStatus: persistedLayout.versionStatus ?? currentLayout.versionStatus ?? savedSnapshot.versionStatus ?? null,
  }
}

function buildPayloadBlocks(blocks: SeatBlockDraft[], bindings: SeatCraftBinding[]): Array<Omit<SeatBlockDraft, 'overrides'>> {
  const primaryGroupByBlock = new Map(bindings
    .filter(binding => (binding.bindingRole ?? 'primary') === 'primary')
    .map(binding => [binding.blockKey, binding.groupKey]))
  return blocks.map(({ overrides: _overrides, ...block }) => ({
    ...block,
    ticketGroupKey: primaryGroupByBlock.get(block.blockKey) ?? block.ticketGroupKey,
  }))
}

function buildVersionedPayloadBlocks(blocks: Array<Omit<SeatBlockDraft, 'overrides'>>): SeatCraftVersionedBlockRequest[] {
  return blocks.map(block => ({
    ...block,
    polygonPoints: Array.isArray(block.polygonPoints) ? JSON.stringify(block.polygonPoints) : block.polygonPoints ?? null,
  }))
}

function buildPayloadTicketGroups(ticketGroups: TicketGroupDraft[], blocks: SeatBlockDraft[], bindings: SeatCraftBinding[]): TicketGroupDraft[] {
  const blockSort = new Map(blocks.map(block => [block.blockKey, block.sort]))
  const sourceBlockKeysByGroup = new Map<string, string[]>()

  for (const binding of [...bindings].sort((left, right) => {
    const sortDelta = (blockSort.get(left.blockKey) ?? left.sort ?? 0) - (blockSort.get(right.blockKey) ?? right.sort ?? 0)
    return sortDelta || left.blockKey.localeCompare(right.blockKey)
  })) {
    const sourceBlockKeys = sourceBlockKeysByGroup.get(binding.groupKey) ?? []
    if (!sourceBlockKeys.includes(binding.blockKey)) sourceBlockKeys.push(binding.blockKey)
    sourceBlockKeysByGroup.set(binding.groupKey, sourceBlockKeys)
  }

  return ticketGroups.map(group => ({
    ...group,
    sourceBlockKeys: sourceBlockKeysByGroup.get(group.groupKey) ?? [],
  }))
}

function buildGridSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[], includeExcluded: boolean) {
  const seats: SeatCraftSeat[] = []
  const rows = positive(block.rows, 0)
  const cols = positive(block.cols, 0)
  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const seatSpacing = positive(block.seatSpacing, DEFAULT_SEAT_SPACING)
  for (let row = 1; row <= rows; row += 1) {
    for (let seat = 1; seat <= cols; seat += 1) {
      const override = overrides.get(key(row, seat))
      const excluded = isExcluded(override)
      if (excluded && !includeExcluded) continue
      seats.push(buildSeat(block, row, seat, block.x + (seat - 1) * seatSpacing, block.y + (row - 1) * rowSpacing, override, selectedSeatIds, undefined, excluded))
    }
  }
  return seats
}

function buildArcSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[], includeExcluded: boolean) {
  const seats: SeatCraftSeat[] = []
  const rows = positive(block.rows, 0)
  const innerRadius = positive(block.innerRadius, DEFAULT_INNER_RADIUS)
  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const seatSpacing = positive(block.seatSpacing, DEFAULT_SEAT_SPACING)
  const startAngle = block.arcStartAngle ?? DEFAULT_ARC_START
  const endAngle = block.arcEndAngle ?? DEFAULT_ARC_END
  const totalAngle = endAngle - startAngle
  const totalRadians = totalAngle * Math.PI / 180

  for (let row = 1; row <= rows; row += 1) {
    const radius = innerRadius + (row - 1) * rowSpacing
    const arcLength = radius * Math.abs(totalRadians)
    const seatsInThisRow = Math.max(1, Math.round(arcLength / seatSpacing) + 1)

    for (let seat = 1; seat <= seatsInThisRow; seat += 1) {
      const override = overrides.get(key(row, seat))
      const excluded = isExcluded(override)
      if (excluded && !includeExcluded) continue
      const t = seatsInThisRow === 1 ? 0.5 : (seat - 1) / (seatsInThisRow - 1)
      const angle = startAngle + (endAngle - startAngle) * t + (block.rotation || 0)
      const radians = angle * Math.PI / 180
      seats.push(buildSeat(block, row, seat, block.x + radius * Math.sin(radians), block.y + radius * Math.cos(radians), override, selectedSeatIds, angle, excluded))
    }
  }
  return seats
}

function buildPolygonSeats(block: SeatBlockDraft, overrides: Map<string, SeatOverrideDraft>, selectedSeatIds: string[], includeExcluded: boolean) {
  const points = block.polygonPoints ?? []
  if (points.length < 3) return []

  const rowSpacing = positive(block.rowSpacing, DEFAULT_ROW_SPACING)
  const seatSpacing = positive(block.seatSpacing, DEFAULT_SEAT_SPACING)
  const bounds = getPolygonBounds(points)
  const seats: SeatCraftSeat[] = []
  let rowNo = 1

  for (let y = bounds.minY; y <= bounds.maxY + POLYGON_EPSILON; y += rowSpacing) {
    let seatNo = 1
    for (let x = bounds.minX; x <= bounds.maxX + POLYGON_EPSILON; x += seatSpacing) {
      if (!pointInPolygon({ x, y }, points)) continue

      const override = overrides.get(key(rowNo, seatNo))
      const excluded = isExcluded(override)
      if (!excluded || includeExcluded) {
        const world = rotateLocalPoint(block, x, y, bounds)
        seats.push(buildSeat(block, rowNo, seatNo, world.x, world.y, override, selectedSeatIds, block.rotation || 0, excluded))
      }
      seatNo += 1
    }
    rowNo += 1
  }

  return seats
}

function getPolygonBounds(points: SeatCraftPoint[]) {
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y)),
  }
}

function rotateLocalPoint(block: SeatBlockDraft, x: number, y: number, bounds: ReturnType<typeof getPolygonBounds>) {
  const rotation = block.rotation || 0
  if (rotation === 0) {
    return { x: block.x + x, y: block.y + y }
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const radians = rotation * Math.PI / 180
  const dx = x - centerX
  const dy = y - centerY
  return {
    x: block.x + centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: block.y + centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

function pointInPolygon(point: SeatCraftPoint, polygon: SeatCraftPoint[]) {
  if (polygon.some((current, index) => pointOnSegment(point, current, polygon[(index + 1) % polygon.length]))) {
    return true
  }

  let inside = false
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const intersects = current.y > point.y !== previous.y > point.y
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    if (intersects) inside = !inside
  }
  return inside
}

function pointOnSegment(point: SeatCraftPoint, start: SeatCraftPoint, end: SeatCraftPoint) {
  if (point.x < Math.min(start.x, end.x) - POLYGON_EPSILON || point.x > Math.max(start.x, end.x) + POLYGON_EPSILON) return false
  if (point.y < Math.min(start.y, end.y) - POLYGON_EPSILON || point.y > Math.max(start.y, end.y) + POLYGON_EPSILON) return false
  return distanceToSegmentSquared(point, start, end) <= POLYGON_EPSILON * POLYGON_EPSILON
}

function distanceToSegmentSquared(point: SeatCraftPoint, start: SeatCraftPoint, end: SeatCraftPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const projectionX = start.x + t * dx
  const projectionY = start.y + t * dy
  return (point.x - projectionX) ** 2 + (point.y - projectionY) ** 2
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
  excluded = false,
): SeatCraftSeat {
  const id = `${block.blockKey}-${rowNo}-${seatNo}`
  return {
    id,
    row: rowNo - 1,
    col: seatNo - 1,
    x: x + (override?.dx ?? 0),
    y: y + (override?.dy ?? 0),
    baseX: x,
    baseY: y,
    angle,
    status: excluded ? 'deleted' : (selectedSeatIds.includes(id) ? 'selected' : 'available'),
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
