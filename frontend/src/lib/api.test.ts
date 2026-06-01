import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createAlipayQrPay, createWaitlistEntry, exportUserAttendees, getActivityMarketing, getGrabOpsSummary, getGrabProgress, getGrabVisibleStock, getTeamGrabProgress, joinTeamGrab, listActivities, removeTeamGrabMember, updateActivityMarketing } from './api.ts'

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

test('loads activity marketing overview through admin endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        activityId: 101,
        activityName: '测试演唱会',
        rule: { enabled: true, discountType: 'FULL_REDUCTION', thresholdAmount: 300, discountAmount: 30 },
        funnelSteps: [],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await getActivityMarketing(101)

    assert.equal(requestedUrl, '/api/ticket/admin/activities/101/marketing')
    assert.equal(result.activityId, 101)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('updates activity marketing without leaking body user id', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  let requestedMethod = ''
  let requestedBody = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input)
    requestedMethod = init?.method ?? 'GET'
    requestedBody = String(init?.body ?? '')
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        activityId: 101,
        activityName: '测试演唱会',
        rule: { enabled: true, discountType: 'FULL_REDUCTION', thresholdAmount: 300, discountAmount: 30 },
        funnelSteps: [],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await updateActivityMarketing(101, {
      userId: 9999,
      enabled: true,
      couponName: '开票满减',
      discountType: 'FULL_REDUCTION',
      thresholdAmount: 300,
      discountAmount: 30,
      maxCouponCount: 500,
      perUserLimit: 1,
    } as any)

    assert.equal(requestedUrl, '/api/ticket/admin/activities/101/marketing')
    assert.equal(requestedMethod, 'PUT')
    assert.equal(requestedBody.includes('userId'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads grab operations summary for platform dashboard', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: {
        failureReasons: [{ reason: '票档售罄', count: 7 }],
        waitlist: { totalCount: 10, paidCount: 4, conversionRate: 0.4 },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await getGrabOpsSummary()

    assert.equal(requestedUrl, '/api/grab/admin/ops-summary')
    assert.equal(result.failureReasons[0].count, 7)
    assert.equal(result.waitlist.conversionRate, 0.4)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('exports user attendees through the masked export endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        fileName: '实名观演人-2004.csv',
        contentType: 'text/csv;charset=UTF-8',
        content: '姓名,证件类型,脱敏证件号\nAlice,ID_CARD,110***********011\n',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await exportUserAttendees()

    assert.equal(requestedUrl, '/api/user/attendees/export')
    assert.equal(result.fileName, '实名观演人-2004.csv')
    assert.equal(result.content.includes('110***********011'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('serializes activity search filters into query params', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: { records: [], total: 0, size: 20, current: 1, pages: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await listActivities({
      page: 1,
      size: 20,
      keyword: '周杰伦',
      city: '上海',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      minPrice: 180,
      maxPrice: 880,
      saleStatus: 'on_sale',
      seatMapOnly: true,
      realNameRequired: false,
      sort: 'price_asc',
    })

    assert.equal(requestedUrl, '/api/ticket/activities?page=1&size=20&keyword=%E5%91%A8%E6%9D%B0%E4%BC%A6&city=%E4%B8%8A%E6%B5%B7&dateFrom=2026-06-01&dateTo=2026-06-30&minPrice=180&maxPrice=880&saleStatus=on_sale&seatMapOnly=true&realNameRequired=false&sort=price_asc')
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

test('localizes english API errors before displaying them', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({
      code: 409,
      message: 'ticket type sold out',
      data: null,
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await assert.rejects(
      () => createWaitlistEntry({ sessionId: 101, ticketTypeId: 202, quantity: 1 }),
      (error) => error instanceof ApiError && error.message === '当前票档已售罄',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
