import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSeatsForBlock, cloneBlock, mirrorBlockHorizontally, snapBlockPosition, toSeatCraftLayoutPayload } from './block-layout'
import type { SeatBlockDraft, SeatCraftLayoutDraft, SeatOverrideDraft } from './types'

function gridBlock(overrides: SeatOverrideDraft[] = []): SeatBlockDraft {
  return {
    id: '1',
    blockKey: 'block-a',
    name: 'A 区',
    blockType: 'gridBlock',
    ticketGroupKey: 'vip',
    x: 100,
    y: 200,
    rotation: 0,
    scale: 1,
    rows: 2,
    cols: 3,
    rowSpacing: 10,
    seatSpacing: 20,
    color: '#34d399',
    sort: 0,
    overrides,
  }
}

test('grid block generates rows times cols seats', () => {
  const seats = buildSeatsForBlock(gridBlock())

  assert.equal(seats.length, 6)
  assert.deepEqual(pick(seats[0], ['id', 'row', 'col', 'x', 'y', 'label']), { id: 'block-a-1-1', row: 0, col: 0, x: 100, y: 200, label: '1排1座' })
})

test('seat overrides hide and move generated seats', () => {
  const seats = buildSeatsForBlock(gridBlock([
    { blockKey: 'block-a', rowNo: 1, seatNo: 1, status: 'hidden', dx: 0, dy: 0 },
    { blockKey: 'block-a', rowNo: 1, seatNo: 2, status: 'visible', dx: 5, dy: 7, customLabel: 'A02' },
  ]))

  assert.equal(seats.length, 5)
  assert.deepEqual(pick(seats[0], ['id', 'x', 'y', 'label']), { id: 'block-a-1-2', x: 125, y: 207, label: 'A02' })
})

test('arc block interpolates curved coordinates', () => {
  const block: SeatBlockDraft = {
    ...gridBlock(),
    blockType: 'arcBlock',
    rows: 1,
    seatsPerRow: 3,
    innerRadius: 80,
    arcStartAngle: 0,
    arcEndAngle: 90,
  }

  const seats = buildSeatsForBlock(block)

  assert.equal(seats.length, 3)
  assert.notEqual(seats[0].x, seats[1].x)
  assert.notEqual(seats[0].y, seats[1].y)
})

test('standing block generates no individual seats', () => {
  const block: SeatBlockDraft = { ...gridBlock(), blockType: 'standingBlock', capacity: 500, width: 180, height: 90 }

  assert.deepEqual(buildSeatsForBlock(block), [])
})

test('clone block creates a shifted unique copy', () => {
  const copy = cloneBlock(gridBlock(), '2', 'block-a-copy')

  assert.deepEqual(pick(copy, ['id', 'blockKey', 'x', 'y']), { id: '2', blockKey: 'block-a-copy', x: 124, y: 224 })
  assert.equal(copy.overrides?.[0]?.blockKey, undefined)
})

test('mirror block horizontally around canvas center', () => {
  const mirrored = mirrorBlockHorizontally({ ...gridBlock(), x: 120, rotation: 15 }, 1000)

  assert.equal(mirrored.x, 880)
  assert.equal(mirrored.rotation, -15)
})

test('snap block position to canvas center or nearby block coordinates', () => {
  const snappedToCenter = snapBlockPosition({ x: 503, y: 397 }, { canvasWidth: 1000, canvasHeight: 800, blocks: [] })
  const snappedToBlock = snapBlockPosition({ x: 204, y: 306 }, { canvasWidth: 1000, canvasHeight: 800, blocks: [{ ...gridBlock(), x: 200, y: 300 }] })

  assert.deepEqual(snappedToCenter, { x: 500, y: 400 })
  assert.deepEqual(snappedToBlock, { x: 200, y: 300 })
})

test('layout payload nests block data under blockLayout', () => {
  const layout: SeatCraftLayoutDraft = {
    id: 9,
    name: '默认座位图',
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [gridBlock()],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: ['block-a'], sort: 0 }],
  }

  const payload = toSeatCraftLayoutPayload(layout)

  assert.equal(payload.blocks, undefined)
  assert.equal(payload.ticketGroups, undefined)
  assert.equal(payload.blockLayout?.blocks?.[0]?.blockKey, 'block-a')
  assert.equal(payload.blockLayout?.ticketGroups?.[0]?.groupKey, 'vip')
})

function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => ({ ...acc, [key]: value[key] }), {} as Pick<T, K>)
}
