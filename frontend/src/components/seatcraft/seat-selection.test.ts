import assert from 'node:assert/strict'
import test from 'node:test'
import { canEditSeatPosition, isSeatKeyMatch, seatEditDisabledReason } from './seat-selection.ts'
import type { ActiveSeatKey, SeatCraftSeat } from './types.ts'

function seat(overrides: Partial<SeatCraftSeat> = {}): SeatCraftSeat {
  return {
    id: 'block-a-1-2',
    row: 0,
    col: 1,
    x: 120,
    y: 220,
    baseX: 100,
    baseY: 200,
    angle: 0,
    status: 'available',
    price: 0,
    sectionKey: 'block-a',
    sectionName: 'A 区',
    label: '2',
    ...overrides,
  }
}

test('seat key matches by block key and logical row seat numbers', () => {
  const key: ActiveSeatKey = { blockKey: 'block-a', rowNo: 1, seatNo: 2 }

  assert.equal(isSeatKeyMatch(key, seat()), true)
  assert.equal(isSeatKeyMatch({ ...key, seatNo: 3 }, seat()), false)
})

test('available seat with base coordinates is editable', () => {
  assert.equal(canEditSeatPosition(seat()), true)
  assert.equal(seatEditDisabledReason(seat()), null)
})

test('occupied and deleted seats are not editable', () => {
  assert.equal(canEditSeatPosition(seat({ status: 'occupied' })), false)
  assert.equal(seatEditDisabledReason(seat({ status: 'occupied' })), '不可移动已占用座位')
  assert.equal(canEditSeatPosition(seat({ status: 'deleted' })), false)
  assert.equal(seatEditDisabledReason(seat({ status: 'deleted' })), '请先恢复座位后再编辑坐标')
})

test('seat without base coordinates is not editable', () => {
  assert.equal(canEditSeatPosition(seat({ baseX: undefined })), false)
  assert.equal(seatEditDisabledReason(seat({ baseX: undefined })), '无法计算座位偏移')
})
