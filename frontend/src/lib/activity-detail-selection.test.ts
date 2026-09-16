import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionDetail } from '@/types/api'
import { resolveInitialPurchaseSelection } from './activity-detail-selection.ts'

const sessions: SessionDetail[] = [
  {
    session: {
      id: 910028,
      activityId: 900028,
      startTime: '2026-09-16T19:30:00',
    } as SessionDetail['session'],
    venue: {
      id: 1,
      name: '广州珠江体育馆',
      address: '广州',
      city: '广州',
    },
    ticketTypes: [
      { id: 920084, sessionId: 910028, name: '普通票', price: 240, totalStock: 100, remainStock: 84, status: 1 },
      { id: 920083, sessionId: 910028, name: 'A区票', price: 360, totalStock: 100, remainStock: 60, status: 1 },
    ],
  },
  {
    session: {
      id: 910029,
      activityId: 900028,
      startTime: '2026-09-17T19:30:00',
    } as SessionDetail['session'],
    venue: {
      id: 1,
      name: '广州珠江体育馆',
      address: '广州',
      city: '广州',
    },
    ticketTypes: [
      { id: 920082, sessionId: 910029, name: 'VIP票', price: 600, totalStock: 100, remainStock: 40, status: 1 },
    ],
  },
]

test('uses the first session and first ticket without query params', () => {
  const result = resolveInitialPurchaseSelection(sessions, null, null)

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('selects the requested session and its default ticket', () => {
  const result = resolveInitialPurchaseSelection(sessions, '910029', null)

  assert.equal(result.session?.session.id, 910029)
  assert.equal(result.ticket?.id, 920082)
})

test('selects the requested ticket only inside the requested session', () => {
  const result = resolveInitialPurchaseSelection(sessions, '910028', '920083')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920083)
})

test('falls back to the first session for an invalid session id', () => {
  const result = resolveInitialPurchaseSelection(sessions, '999999', null)

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('does not use a ticket id from another session after session fallback', () => {
  const result = resolveInitialPurchaseSelection(sessions, '999999', '920082')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('falls back to the selected session default ticket for an invalid ticket id', () => {
  const result = resolveInitialPurchaseSelection(sessions, '910028', '999999')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('does not select a ticket that belongs to another session', () => {
  const result = resolveInitialPurchaseSelection(sessions, '910028', '920082')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('falls back completely when both query ids are invalid', () => {
  const result = resolveInitialPurchaseSelection(sessions, 'bad', 'also-bad')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket?.id, 920084)
})

test('returns empty selection for empty sessions', () => {
  assert.deepEqual(resolveInitialPurchaseSelection([], '910028', '920084'), {
    session: null,
    ticket: null,
  })
})

test('returns the selected session with no ticket when it has no ticket types', () => {
  const emptyTicketSession: SessionDetail = {
    ...sessions[0],
    ticketTypes: [],
  }

  const result = resolveInitialPurchaseSelection([emptyTicketSession], '910028', '920084')

  assert.equal(result.session?.session.id, 910028)
  assert.equal(result.ticket, null)
})
