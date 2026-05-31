import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatOrderAttendees } from './console-orders.ts'
import type { OrderEntity } from '../types/api.ts'

test('formats order attendees for console display', () => {
  const order = {
    attendees: [
      { id: 1, orderId: 10, attendeeUserProfileId: 501, realName: 'Alice', idType: 'ID_CARD', idNoMask: '110***********011', phone: null, status: 1 },
      { id: 2, orderId: 10, attendeeUserProfileId: 502, realName: 'Bob', idType: 'ID_CARD', idNoMask: '110***********022', phone: null, status: 1 },
    ],
  } as OrderEntity

  assert.equal(formatOrderAttendees(order), 'Alice 110***********011；Bob 110***********022')
})

test('returns placeholder when an order has no attendees', () => {
  assert.equal(formatOrderAttendees({ attendees: [] } as unknown as OrderEntity), '-')
})
