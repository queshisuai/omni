import assert from 'node:assert/strict'
import { test } from 'node:test'
import { autoArrangeSeatLayout, buildSeatCraftBindings, buildSeatsForBlock, cloneBlock, getSeatCraftPrimaryBindingValue, mergePersistedSeatCraftLayout, mirrorBlockHorizontally, snapBlockPosition, toSeatCraftLayoutPayload, toSeatCraftVersionedLayoutPayload, updateSeatCraftPrimaryBinding } from './block-layout.ts'
import { toSeatCraftLayoutDraft, toSeatCraftVersionedLayoutDraft } from './types.ts'
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

function polygonBlock(overrides: SeatOverrideDraft[] = []): SeatBlockDraft {
  return {
    ...gridBlock(overrides),
    blockKey: 'poly-a',
    name: '异形区',
    blockType: 'polygonBlock',
    x: 10,
    y: 20,
    rows: null,
    cols: null,
    seatsPerRow: null,
    rowSpacing: 10,
    seatSpacing: 10,
    polygonPoints: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ],
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
  assertApproxSeat(seats[0], { x: 180, y: 200 })
  assertApproxSeat(seats[1], { x: 156.57, y: 256.57 })
  assertApproxSeat(seats[2], { x: 100, y: 280 })
  assert.notEqual(seats[0].x, seats[1].x)
  assert.notEqual(seats[0].y, seats[1].y)
})

test('arc block uses theater fan geometry with rows expanding from center', () => {
  const block: SeatBlockDraft = {
    ...gridBlock(),
    blockType: 'arcBlock',
    x: 500,
    y: 300,
    rows: 2,
    seatsPerRow: 3,
    innerRadius: 100,
    rowSpacing: 40,
    arcStartAngle: -60,
    arcEndAngle: 60,
  }

  const seats = buildSeatsForBlock(block)

  assert.equal(seats.length, 6)
  assertApproxSeat(seats[0], { x: 550, y: 213.4 })
  assertApproxSeat(seats[1], { x: 600, y: 300 })
  assertApproxSeat(seats[2], { x: 550, y: 386.6 })
  assertApproxSeat(seats[4], { x: 640, y: 300 })
  assert.ok(Math.abs(seats[3].y - block.y) > Math.abs(seats[0].y - block.y))
  assert.ok(Math.abs(seats[5].y - block.y) > Math.abs(seats[2].y - block.y))
})

test('standing block generates no individual seats', () => {
  const block: SeatBlockDraft = { ...gridBlock(), blockType: 'standingBlock', capacity: 500, width: 180, height: 90 }

  assert.deepEqual(buildSeatsForBlock(block), [])
})

test('polygon block fills seats inside polygon bounds', () => {
  const seats = buildSeatsForBlock(polygonBlock())

  assert.equal(seats.length, 9)
  assert.deepEqual(pick(seats[0], ['id', 'row', 'col', 'x', 'y']), { id: 'poly-a-1-1', row: 0, col: 0, x: 10, y: 20 })
  assert.deepEqual(pick(seats[8], ['id', 'row', 'col', 'x', 'y']), { id: 'poly-a-3-3', row: 2, col: 2, x: 30, y: 40 })
})

test('polygon block excludes candidates outside polygon', () => {
  const block: SeatBlockDraft = {
    ...polygonBlock(),
    polygonPoints: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 20 },
    ],
  }

  const seats = buildSeatsForBlock(block)

  assert.equal(seats.length, 6)
  assert.deepEqual(seats.map(seat => seat.id), ['poly-a-1-1', 'poly-a-1-2', 'poly-a-1-3', 'poly-a-2-1', 'poly-a-2-2', 'poly-a-3-1'])
})

test('polygon block applies hidden and moved overrides', () => {
  const seats = buildSeatsForBlock(polygonBlock([
    { blockKey: 'poly-a', rowNo: 1, seatNo: 1, status: 'hidden', dx: 0, dy: 0 },
    { blockKey: 'poly-a', rowNo: 1, seatNo: 2, status: 'visible', dx: 5, dy: 7, customLabel: 'P02' },
  ]))

  assert.equal(seats.length, 8)
  assert.deepEqual(pick(seats[0], ['id', 'x', 'y', 'label']), { id: 'poly-a-1-2', x: 25, y: 27, label: 'P02' })
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

test('auto arrange layout positions blocks only when explicitly requested', () => {
  const layout: SeatCraftLayoutDraft = {
    id: 9,
    name: '默认座位图',
    templateType: 'concert',
    stage: { title: '舞台', x: 500, y: 60 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [gridBlock(), { ...gridBlock(), id: '2', blockKey: 'block-b', name: 'B 区', x: 123, y: 456 }],
    ticketGroups: [],
  }

  const arranged = autoArrangeSeatLayout(layout)

  assert.deepEqual(arranged.blocks?.map(block => pick(block, ['x', 'y'])), [{ x: 120, y: 180 }, { x: 420, y: 180 }])
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

test('explicit bindings are preserved with default role and sort', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), sort: 7 }],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip' }],
  })

  assert.deepEqual(buildSeatCraftBindings(layout), [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 7 },
  ])
})

test('bindings fallback to block ticketGroupKey when layout has no bindings', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'vip', sort: 2 }],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
  })

  assert.deepEqual(buildSeatCraftBindings(layout), [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 2 },
  ])
})

test('partial explicit bindings append block ticketGroupKey fallback for missing blocks', () => {
  const layout = layoutWithBlocks({
    blocks: [
      { ...gridBlock(), blockKey: 'block-a', ticketGroupKey: '', sort: 1 },
      { ...gridBlock(), blockKey: 'block-b', ticketGroupKey: 'standard', sort: 2 },
    ],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 },
    ],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
  })

  assert.deepEqual(buildSeatCraftBindings(layout), [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 1 },
    { blockKey: 'block-b', groupKey: 'standard', bindingRole: 'primary', sort: 2 },
  ])
})

test('explicit primary binding is not overridden by block ticketGroupKey fallback', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'standard', sort: 1 }],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 },
    ],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
  })

  assert.deepEqual(buildSeatCraftBindings(layout), [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 1 },
  ])
})

test('layout payload uses bindings to aggregate stable source block keys', () => {
  const layout = layoutWithBlocks({
    blocks: [
      { ...gridBlock(), id: '1', blockKey: 'block-b', ticketGroupKey: '', sort: 2 },
      { ...gridBlock(), id: '2', blockKey: 'block-a', ticketGroupKey: '', sort: 1 },
      { ...gridBlock(), id: '3', blockKey: 'block-c', ticketGroupKey: '', sort: 1 },
    ],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [
      { blockKey: 'block-b', groupKey: 'vip', bindingRole: 'primary' },
      { blockKey: 'block-c', groupKey: 'vip', bindingRole: 'secondary' },
      { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' },
    ],
  })

  const payload = toSeatCraftLayoutPayload(layout)

  assert.deepEqual(payload.blockLayout?.bindings, [
    { blockKey: 'block-b', groupKey: 'vip', bindingRole: 'primary', sort: 2 },
    { blockKey: 'block-c', groupKey: 'vip', bindingRole: 'secondary', sort: 1 },
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 1 },
  ])
  assert.deepEqual(payload.blockLayout?.ticketGroups[0]?.sourceBlockKeys, ['block-a', 'block-c', 'block-b'])
  assert.deepEqual(payload.blockLayout?.blocks.map(block => pick(block, ['blockKey', 'ticketGroupKey'])), [
    { blockKey: 'block-b', ticketGroupKey: 'vip' },
    { blockKey: 'block-a', ticketGroupKey: 'vip' },
    { blockKey: 'block-c', ticketGroupKey: '' },
  ])
})

test('invalid bindings are filtered and duplicate block role keeps first valid binding', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', sort: 0 }],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 },
    ],
    bindings: [
      { blockKey: '', groupKey: 'vip' },
      { blockKey: 'missing', groupKey: 'vip' },
      { blockKey: 'block-a', groupKey: 'missing' },
      { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' },
      { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'primary' },
    ],
  })

  assert.deepEqual(buildSeatCraftBindings(layout), [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 },
  ])
})

test('layout draft preserves valid secondary bindings and fills missing block ticketGroupKey from primary bindings', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    blockLayout: {
      name: '默认座位图',
      canvasWidth: 1000,
      canvasHeight: 800,
      blocks: [apiBlock({ blockKey: 'block-a', ticketGroupKey: undefined })],
      overrides: [],
      ticketGroups: [
        { groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 },
        { groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 },
      ],
      bindings: [
        { blockKey: '', groupKey: 'vip', bindingRole: 'primary' },
        { blockKey: 'block-a', groupKey: 'vip', bindingRole: null, sort: 5 },
        { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'primary', sort: 6 },
        { blockKey: '', groupKey: 'standard', bindingRole: 'primary' },
        { blockKey: 'block-a', groupKey: '', bindingRole: 'primary' },
        { blockKey: 'missing', groupKey: 'standard', bindingRole: 'primary' },
        { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'secondary' },
        { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'secondary' },
      ],
    },
  }))

  assert.deepEqual(draft.bindings, [
    { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 5 },
    { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'secondary', sort: 0 },
  ])
  assert.equal(draft.blocks?.[0]?.ticketGroupKey, 'vip')
})

test('layout draft does not backfill block ticketGroupKey from secondary bindings', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    blockLayout: {
      name: '默认座位图',
      canvasWidth: 1000,
      canvasHeight: 800,
      blocks: [apiBlock({ blockKey: 'block-a', ticketGroupKey: undefined })],
      overrides: [],
      ticketGroups: [{ groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 }],
      bindings: [{ blockKey: 'block-a', groupKey: 'standard', bindingRole: 'secondary' }],
    },
  }))

  assert.deepEqual(draft.bindings, [
    { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'secondary', sort: 0 },
  ])
  assert.equal(draft.blocks?.[0]?.ticketGroupKey, '')
})

test('primary binding value returns empty for unknown groups or disabled binding edit', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'missing' }],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'missing', bindingRole: 'primary' }],
  })

  assert.equal(getSeatCraftPrimaryBindingValue(layout, 'block-a'), '')
  assert.equal(getSeatCraftPrimaryBindingValue(layout, 'block-a', false), '')
})

test('layout draft keeps explicit block ticketGroupKey over primary bindings', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    blockLayout: {
      name: '默认座位图',
      canvasWidth: 1000,
      canvasHeight: 800,
      blocks: [apiBlock({ blockKey: 'block-a', ticketGroupKey: 'standard' })],
      overrides: [],
      ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
      bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
    },
  }))

  assert.equal(draft.blocks?.[0]?.ticketGroupKey, 'standard')
})

test('layout draft preserves version metadata from versioned SeatCraft API', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
  }))

  assert.equal(draft.versionId, 88)
  assert.equal(draft.versionNo, 5)
  assert.equal(draft.versionStatus, 'draft')
})

test('layout draft preserves version metadata from nested block layout', () => {
  const draft = toSeatCraftLayoutDraft(seatCraftLayoutVo({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'published',
    blockLayout: {
      versionId: 99,
      versionNo: 6,
      versionStatus: 'draft',
      name: '默认座位图',
      canvasWidth: 1000,
      canvasHeight: 800,
      blocks: [],
      overrides: [],
      ticketGroups: [],
      bindings: [],
    },
  }))

  assert.equal(draft.versionId, 99)
  assert.equal(draft.versionNo, 6)
  assert.equal(draft.versionStatus, 'draft')
})

test('versioned layout without sections or stage converts to draft and preserves version metadata', () => {
  const draft = toSeatCraftVersionedLayoutDraft({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
    name: '版本草稿',
    canvasWidth: 1200,
    canvasHeight: 900,
    blocks: [apiBlock()],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
  })

  assert.deepEqual(pick(draft, ['id', 'versionId', 'versionNo', 'versionStatus', 'name', 'templateType', 'canvasWidth', 'canvasHeight']), {
    id: 88,
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
    name: '版本草稿',
    templateType: 'concert',
    canvasWidth: 1200,
    canvasHeight: 900,
  })
  assert.deepEqual(draft.stage, { title: '舞台', x: 0, y: 0 })
  assert.deepEqual(draft.sections, [])
  assert.equal(draft.blocks?.[0]?.blockKey, 'block-a')
  assert.deepEqual(draft.bindings, [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }])
})

test('legacy blank layout response converts through versioned adapter', () => {
  const draft = toSeatCraftVersionedLayoutDraft(seatCraftLayoutVo({
    id: 123,
    activityId: 456,
    name: '空白座位图',
    stageTitle: '主舞台',
    stageX: 500,
    stageY: 80,
    sections: [],
  }))

  assert.deepEqual(pick(draft, ['id', 'activityId', 'versionId', 'versionNo', 'versionStatus', 'name']), {
    id: 123,
    activityId: 456,
    versionId: null,
    versionNo: null,
    versionStatus: null,
    name: '空白座位图',
  })
  assert.deepEqual(draft.stage, { title: '主舞台', x: 500, y: 80 })
  assert.deepEqual(draft.sections, [])
  assert.deepEqual(draft.blocks, [])
  assert.deepEqual(draft.ticketGroups, [])
  assert.deepEqual(draft.bindings, [])
})

test('versioned save payload exposes block layout fields and stage metadata at top level without blockLayout', () => {
  const payload = toSeatCraftVersionedLayoutPayload(layoutWithBlocks({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
    name: '版本草稿',
    templateType: 'custom',
    stage: { title: '主舞台', x: 360, y: 96 },
    blocks: [gridBlock()],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
  }))

  assert.equal('blockLayout' in payload, false)
  assert.equal(payload.versionId, 88)
  assert.equal(payload.versionNo, 5)
  assert.equal(payload.versionStatus, 'draft')
  assert.equal(payload.templateType, 'custom')
  assert.equal(payload.stageTitle, '主舞台')
  assert.equal(payload.stageX, 360)
  assert.equal(payload.stageY, 96)
  assert.equal(payload.blocks?.[0]?.blockKey, 'block-a')
  assert.equal(payload.blocks?.[0]?.ticketGroupKey, 'vip')
  assert.deepEqual(payload.bindings, [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }])
  assert.deepEqual(payload.ticketGroups?.[0]?.sourceBlockKeys, ['block-a'])
})

test('versioned layout draft round trips stage metadata through payload', () => {
  const draft = toSeatCraftVersionedLayoutDraft({
    versionId: 88,
    name: '版本草稿',
    templateType: 'cinema',
    stageTitle: '副舞台',
    stageX: 240,
    stageY: 72,
    canvasWidth: 1200,
    canvasHeight: 900,
    blocks: [apiBlock()],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary' }],
  })

  const payload = toSeatCraftVersionedLayoutPayload(draft)

  assert.equal(payload.templateType, 'cinema')
  assert.equal(payload.stageTitle, '副舞台')
  assert.equal(payload.stageX, 240)
  assert.equal(payload.stageY, 72)
})

test('persisted version metadata does not overwrite edits made while saving', () => {
  const requestLayout = layoutWithBlocks({
    versionId: 88,
    versionNo: 5,
    versionStatus: 'draft',
    stage: { title: '舞台', x: 10, y: 20 },
    blocks: [gridBlock()],
  })
  const localEditedLayout = {
    ...requestLayout,
    stage: { title: '舞台', x: 360, y: 96 },
  }
  const persistedLayout = {
    ...requestLayout,
    versionId: 99,
    versionNo: 6,
    versionStatus: 'draft' as const,
    stage: { title: '舞台', x: 10, y: 20 },
  }

  const merged = mergePersistedSeatCraftLayout(localEditedLayout, requestLayout, persistedLayout)

  assert.equal(merged.versionId, 99)
  assert.equal(merged.versionNo, 6)
  assert.deepEqual(merged.stage, { title: '舞台', x: 360, y: 96 })
})

test('versioned save payload serializes polygonPoints as string for polygon blocks', () => {
  const payload = toSeatCraftVersionedLayoutPayload(layoutWithBlocks({
    blocks: [polygonBlock()],
  }))

  assert.equal(typeof payload.blocks?.[0]?.polygonPoints, 'string')
  assert.equal(payload.blocks?.[0]?.polygonPoints, JSON.stringify(polygonBlock().polygonPoints))
})

test('versioned layout draft parses string polygonPoints from versioned API', () => {
  const polygonPoints = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
  ]
  const draft = toSeatCraftVersionedLayoutDraft({
    versionId: 88,
    name: '版本草稿',
    canvasWidth: 1200,
    canvasHeight: 900,
    blocks: [apiBlock({ blockType: 'polygonBlock', polygonPoints: JSON.stringify(polygonPoints) })],
  })

  assert.deepEqual(draft.blocks?.[0]?.polygonPoints, polygonPoints)
})

test('update primary binding adds binding and does not mutate input', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', ticketGroupKey: '' }],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: [], sort: 1 },
    ],
    bindings: [],
  })
  const before = structuredClone(layout)

  const next = updateSeatCraftPrimaryBinding(layout, 'block-a', 'vip')

  assert.deepEqual(layout, before)
  assert.deepEqual(next.bindings, [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }])
  assert.equal(next.blocks?.[0]?.ticketGroupKey, 'vip')
  assert.deepEqual(next.ticketGroups?.map(group => pick(group, ['groupKey', 'sourceBlockKeys'])), [
    { groupKey: 'vip', sourceBlockKeys: ['block-a'] },
    { groupKey: 'standard', sourceBlockKeys: [] },
  ])
})

test('update primary binding clears binding and compatibility fields when group is empty', () => {
  const layout = layoutWithBlocks({
    blocks: [{ ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'vip' }],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: ['block-a', 'block-b'], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }],
  })

  const next = updateSeatCraftPrimaryBinding(layout, 'block-a', '')

  assert.deepEqual(next.bindings, [])
  assert.equal(next.blocks?.[0]?.ticketGroupKey, '')
  assert.deepEqual(next.ticketGroups?.[0]?.sourceBlockKeys, ['block-b'])
})

test('update primary binding replaces binding and moves source block keys stably', () => {
  const layout = layoutWithBlocks({
    blocks: [
      { ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'vip', sort: 0 },
      { ...gridBlock(), blockKey: 'block-b', ticketGroupKey: 'standard', sort: 1 },
    ],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: ['block-a', 'block-c'], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: ['block-b'], sort: 1 },
    ],
    bindings: [
      { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 },
      { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 99 },
      { blockKey: 'block-b', groupKey: 'standard', bindingRole: 'primary', sort: 1 },
    ],
  })

  const next = updateSeatCraftPrimaryBinding(layout, 'block-a', 'standard')

  assert.deepEqual(next.bindings, [
    { blockKey: 'block-b', groupKey: 'standard', bindingRole: 'primary', sort: 1 },
    { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'primary', sort: 0 },
  ])
  assert.deepEqual(next.blocks?.map(block => pick(block, ['blockKey', 'ticketGroupKey'])), [
    { blockKey: 'block-a', ticketGroupKey: 'standard' },
    { blockKey: 'block-b', ticketGroupKey: 'standard' },
  ])
  assert.deepEqual(next.ticketGroups?.map(group => pick(group, ['groupKey', 'sourceBlockKeys'])), [
    { groupKey: 'vip', sourceBlockKeys: ['block-c'] },
    { groupKey: 'standard', sourceBlockKeys: ['block-b', 'block-a'] },
  ])
})

test('update primary binding preserves duplicate primary bindings for other blocks', () => {
  const layout = layoutWithBlocks({
    blocks: [
      { ...gridBlock(), blockKey: 'block-a', ticketGroupKey: 'vip', sort: 0 },
      { ...gridBlock(), blockKey: 'block-b', ticketGroupKey: 'standard', sort: 1 },
    ],
    ticketGroups: [
      { groupKey: 'vip', name: 'VIP', sourceBlockKeys: ['block-a'], sort: 0 },
      { groupKey: 'standard', name: '普通', sourceBlockKeys: ['block-b'], sort: 1 },
    ],
    bindings: [
      { blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 },
      { blockKey: 'block-b', groupKey: 'standard', bindingRole: 'primary', sort: 1 },
      { blockKey: 'block-b', groupKey: 'vip', bindingRole: 'primary', sort: 99 },
    ],
  })

  const next = updateSeatCraftPrimaryBinding(layout, 'block-a', 'standard')

  assert.deepEqual(next.bindings, [
    { blockKey: 'block-b', groupKey: 'standard', bindingRole: 'primary', sort: 1 },
    { blockKey: 'block-b', groupKey: 'vip', bindingRole: 'primary', sort: 99 },
    { blockKey: 'block-a', groupKey: 'standard', bindingRole: 'primary', sort: 0 },
  ])
})

function layoutWithBlocks(updates: Partial<SeatCraftLayoutDraft>): SeatCraftLayoutDraft {
  return {
    id: 9,
    name: '默认座位图',
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [],
    ticketGroups: [],
    ...updates,
  }
}

function seatCraftLayoutVo(updates: Record<string, unknown> = {}) {
  return {
    id: 9,
    venueId: null,
    activityId: null,
    sessionId: null,
    name: '默认座位图',
    templateType: 'concert',
    stageTitle: '舞台',
    stageX: 0,
    stageY: 0,
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    ...updates,
  } as never
}

function apiBlock(updates: Record<string, unknown> = {}) {
  return {
    id: 1,
    blockKey: 'block-a',
    name: 'A 区',
    blockType: 'gridBlock' as const,
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
    ...updates,
  }
}

function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => ({ ...acc, [key]: value[key] }), {} as Pick<T, K>)
}

function assertApproxSeat(seat: { x: number; y: number }, expected: { x: number; y: number }) {
  assert.equal(Math.round(seat.x * 100) / 100, expected.x)
  assert.equal(Math.round(seat.y * 100) / 100, expected.y)
}
