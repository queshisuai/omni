import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, addSupportNote, closeSupportConversation, createAlipayQrPay, createOrganizerAdminAccount, createReconciliationBatch, createWaitlistEntry, deactivateOrganizerAdminAccount, escalateSupportConversation, exportUserAttendees, getActivityMarketing, getGrabOpsSummary, getGrabProgress, getGrabVisibleStock, getTeamGrabProgress, joinTeamGrab, listActivities, listEnabledSupportAgents, listExceptionTasks, listOperationAuditLogs, listOrganizerAdminAccounts, listRbacPermissions, listRbacRoles, listReconciliationBatches, listSupportAudits, listSupportNotes, listSupportQuickReplies, rejectCloseSupportConversation, removeTeamGrabMember, transferSupportConversation, updateActivityMarketing, updateRbacRolePermissions, updateSupportTags } from './api.ts'

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
    })

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

test('loads exception tasks through user console endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: [{ id: 1, taskType: 'abnormal_refund', businessNo: 'RF1', severity: 'high', status: 'pending', reason: '退款结果未知' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await listExceptionTasks()

    assert.equal(requestedUrl, '/api/user/console/exception-tasks')
    assert.equal(result[0].taskType, 'abnormal_refund')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads and creates reconciliation batches through user console endpoint', async () => {
  const originalFetch = globalThis.fetch
  const requested: Array<{ url: string; method: string; body: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: init?.method === 'POST'
        ? { id: 2, batchNo: 'REC20260602-00000002', bizDate: '2026-06-02', sourceType: 'local', status: 'generated' }
        : [{ id: 1, batchNo: 'REC20260601-00000001', bizDate: '2026-06-01', sourceType: 'local', status: 'generated' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const batches = await listReconciliationBatches()
    const created = await createReconciliationBatch('2026-06-02')

    assert.equal(requested[0].url, '/api/user/console/reconciliation/batches')
    assert.equal(requested[1].url, '/api/user/console/reconciliation/batches')
    assert.equal(requested[1].method, 'POST')
    assert.equal(requested[1].body, JSON.stringify({ bizDate: '2026-06-02' }))
    assert.equal(batches[0].batchNo, 'REC20260601-00000001')
    assert.equal(created.batchNo, 'REC20260602-00000002')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads and updates rbac roles through user console endpoint', async () => {
  const originalFetch = globalThis.fetch
  const requested: Array<{ url: string; method: string; body: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
    const url = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: url.endsWith('/rbac/permissions')
          ? [{ code: 'rbac.manage', name: '角色权限管理', description: '管理后台角色授权' }]
          : url.includes('/rbac/roles/') && url.endsWith('/permissions')
            ? undefined
            : [{ code: 'platform_super_admin', name: '平台超管', status: 1, permissionCodes: ['rbac.manage'] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const roles = await listRbacRoles()
    const permissions = await listRbacPermissions()
    await updateRbacRolePermissions('support_manager', ['support.account.manage'])

    assert.equal(requested[0].url, '/api/user/console/rbac/roles')
    assert.equal(requested[1].url, '/api/user/console/rbac/permissions')
    assert.equal(requested[2].url, '/api/user/console/rbac/roles/support_manager/permissions')
    assert.equal(requested[2].method, 'PUT')
    assert.equal(requested[2].body, JSON.stringify({ permissionCodes: ['support.account.manage'] }))
    assert.equal(roles[0].code, 'platform_super_admin')
    assert.equal(permissions[0].code, 'rbac.manage')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('manages organizer admin accounts through user console endpoint', async () => {
  const originalFetch = globalThis.fetch
  const requested: Array<{ url: string; method: string; body: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: init?.method === 'POST'
        ? { id: 12, phone: '13900000004', nickname: '主办方管理员', role: 'organizer_admin', status: 1 }
        : [{ id: 11, phone: '13900000003', nickname: '主办方管理员', role: 'organizer_admin', status: 1 }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const accounts = await listOrganizerAdminAccounts()
    const created = await createOrganizerAdminAccount({ phone: '13900000004', nickname: '主办方管理员', password: 'admin123' })
    await deactivateOrganizerAdminAccount(11)

    assert.equal(requested[0].url, '/api/user/console/organizer-admins')
    assert.equal(requested[1].url, '/api/user/console/organizer-admins')
    assert.equal(requested[1].method, 'POST')
    assert.equal(requested[1].body, JSON.stringify({ phone: '13900000004', nickname: '主办方管理员', password: 'admin123' }))
    assert.equal(requested[2].url, '/api/user/console/organizer-admins/11')
    assert.equal(requested[2].method, 'DELETE')
    assert.equal(accounts[0].role, 'organizer_admin')
    assert.equal(created.id, 12)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loads operation audit logs through user console endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: [{ id: 1, operatorId: 7, operatorRole: 'platform_super_admin', action: 'rbac.role_permission.update', targetType: 'rbac_role', success: true }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await listOperationAuditLogs({
      operatorId: 7,
      action: 'rbac.role_permission.update',
      targetType: 'rbac_role',
      success: true,
      traceId: 'trace-abc',
      limit: 50,
    })

    assert.equal(requestedUrl, '/api/user/console/audit-logs?operatorId=7&action=rbac.role_permission.update&targetType=rbac_role&success=true&traceId=trace-abc&limit=50')
    assert.equal(result[0].operatorRole, 'platform_super_admin')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uses support conversation operation endpoints', async () => {
  const originalFetch = globalThis.fetch
  const requested: Array<{ url: string; method: string; body: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
    const url = String(input)
    const data = url.endsWith('/notes')
      ? init?.method === 'POST'
        ? { id: 9, conversationId: 88, content: '内部备注' }
        : []
      : url.endsWith('/audits') || url.endsWith('/quick-replies') || url.endsWith('/accounts')
        ? []
        : { id: 88, status: 'ASSIGNED' }
    return new Response(JSON.stringify({ code: 200, message: '成功', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await listSupportNotes(88)
    await addSupportNote(88, '内部备注')
    await updateSupportTags(88, ['REFUND'])
    await listSupportQuickReplies()
    await listEnabledSupportAgents()
    await transferSupportConversation(88, 31, '需要专员处理')
    await escalateSupportConversation(88, '疑似异常退款')
    await listSupportAudits(88)
    await closeSupportConversation(88, '已解决')
    await rejectCloseSupportConversation(88, '继续处理')

    assert.deepEqual(requested.map(item => [item.url, item.method, item.body]), [
      ['/api/user/support/agent/conversations/88/notes', 'GET', ''],
      ['/api/user/support/agent/conversations/88/notes', 'POST', JSON.stringify({ content: '内部备注' })],
      ['/api/user/support/agent/conversations/88/tags', 'PUT', JSON.stringify({ tags: ['REFUND'] })],
      ['/api/user/support/agent/quick-replies', 'GET', ''],
      ['/api/user/support/agent/accounts', 'GET', ''],
      ['/api/user/support/agent/conversations/88/transfer', 'POST', JSON.stringify({ targetAgentId: 31, reason: '需要专员处理' })],
      ['/api/user/support/agent/conversations/88/escalate', 'POST', JSON.stringify({ reason: '疑似异常退款' })],
      ['/api/user/support/agent/conversations/88/audits', 'GET', ''],
      ['/api/user/support/agent/conversations/88/close', 'POST', JSON.stringify({ reason: '已解决' })],
      ['/api/user/support/conversations/88/close/reject', 'POST', JSON.stringify({ reason: '继续处理' })],
    ])
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
