import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAlipayQrPay, getGrabProgress, getGrabVisibleStock, getTeamGrabProgress, joinTeamGrab, removeTeamGrabMember } from './api.ts'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('allows alipay qr pay response that takes longer than the default request timeout', async () => {
  const originalFetch = globalThis.fetch
  let aborted = false
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true
    })
    await wait(6000)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        orderId: 9001,
        orderNo: 'O1',
        amount: 200,
        qrCode: 'qr-code',
        qrCodeUrl: 'https://example.invalid/qr',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await createAlipayQrPay(9001)

    assert.equal(aborted, false)
    assert.equal(result.orderId, 9001)
    assert.equal(result.qrCode, 'qr-code')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads grab progress by request id', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { requestId: 'GRAB1', status: 'WAITING', queueRank: 3 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await getGrabProgress('GRAB1')

    assert.equal(requestedUrl, '/api/grab/requests/GRAB1/progress')
    assert.equal(result.status, 'WAITING')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads visible stock with ticket type query params', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { sessionId: 101, ticketTypes: [], snapshotTime: '2026-05-29T12:00:00.000Z' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await getGrabVisibleStock(101, [1, 2])

    assert.equal(requestedUrl, '/api/grab/sessions/101/stock-visible?ticketTypeIds=1%2C2')
    assert.equal(result.sessionId, 101)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads team grab progress through the team-scoped endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { requestId: 'GRAB1', status: 'WAITING', queueRank: 3 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await getTeamGrabProgress(7, 'GRAB1')

    assert.equal(requestedUrl, '/api/grab/teams/7/requests/GRAB1/progress')
    assert.equal(result.status, 'WAITING')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('joins a team with a normalized invite code in the request body', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  let requestedBody = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input)
    requestedBody = String(init?.body ?? '')
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { id: 7, inviteCode: 'TEAM1234', leaderUserId: 100, activityId: 10, sessionId: 20, ticketTypeId: 30, size: 2, strategy: 'SAME_BLOCK', fallbacks: [], status: 'DRAFT' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await joinTeamGrab(7, ' team1234 ')

    assert.equal(requestedUrl, '/api/grab/teams/7/join')
    assert.equal(requestedBody, JSON.stringify({ inviteCode: 'TEAM1234' }))
    assert.equal(result.id, 7)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('removes a team member through the leader endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  let requestedMethod = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input)
    requestedMethod = init?.method ?? 'GET'
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { id: 7, inviteCode: 'TEAM1234', leaderUserId: 100, activityId: 10, sessionId: 20, ticketTypeId: 30, size: 1, strategy: 'SAME_BLOCK', fallbacks: [], status: 'DRAFT' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await removeTeamGrabMember(7, 200)

    assert.equal(requestedUrl, '/api/grab/teams/7/members/200')
    assert.equal(requestedMethod, 'DELETE')
    assert.equal(result.size, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
