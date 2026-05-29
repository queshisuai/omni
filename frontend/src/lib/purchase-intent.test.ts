import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSeatAllocationPayload } from './purchase-intent.ts'

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
