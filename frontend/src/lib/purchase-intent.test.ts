import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildGrabIdempotencyIntent,
  buildSeatAllocationPayload,
  canShowPurchaseEntry,
  getPurchaseQuantityMax,
} from './purchase-intent.ts'

test('requests random seat allocation for seat-bound tickets when seat map is hidden', () => {
  const payload = buildSeatAllocationPayload({
    ticket: { seatBlockId: 39, ticketGroupKey: 'area-3' },
    seatSelectionVisible: false,
    selectedSeatIds: [],
  })

  assert.deepEqual(payload, { seatIds: [], allocateRandom: true })
})

test('uses selected seats without random allocation when visible seat selection is used', () => {
  const payload = buildSeatAllocationPayload({
    ticket: { seatBlockId: 39, ticketGroupKey: 'area-3' },
    seatSelectionVisible: true,
    selectedSeatIds: [201, 202],
  })

  assert.deepEqual(payload, { seatIds: [201, 202], allocateRandom: false })
})

test('does not request random seat allocation for seatless tickets', () => {
  const payload = buildSeatAllocationPayload({
    ticket: { seatBlockId: null, ticketGroupKey: null },
    seatSelectionVisible: false,
    selectedSeatIds: [],
  })

  assert.deepEqual(payload, { seatIds: [], allocateRandom: false })
})

test('includes downgrade authorization and ordered ticket preferences in grab idempotency intent', () => {
  const intent = buildGrabIdempotencyIntent({
    userId: 7,
    sessionId: 11,
    selectedTicketId: 101,
    quantity: 2,
    seatIds: [9, 3],
    allocateRandom: false,
    allowAutoDowngrade: true,
    ticketTypePreferences: [
      { ticketTypeId: 101, name: 'A', maxPrice: 580 },
      { ticketTypeId: 102, name: 'B', maxPrice: 380 },
    ],
  })

  assert.equal(intent, '7:11:101:2:3,9:false:true:101|580|A>102|380|B')
})

test('shows purchase entry when visible stock is available even if remainStock is stale zero', () => {
  assert.equal(
    canShowPurchaseEntry({
      ticket: { remainStock: 0 },
      visibleStock: { visibleStock: 3 },
    }),
    true,
  )
})

test('quantity max prefers authoritative visible stock over stale remainStock', () => {
  assert.equal(
    getPurchaseQuantityMax({
      ticket: { remainStock: 0 },
      visibleStock: { visibleStock: 4 },
    }),
    4,
  )
})
