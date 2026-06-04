import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildConsoleOrderExportCsv, filterConsoleOrdersByStatus, formatOrderAttendees, getConsoleOrderScopeCopy, getSelectedConsoleOrders } from './console-orders.ts'
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

test('builds masked console order csv for selected orders', () => {
  const orders = [
    {
      id: 10,
      orderNo: 'O-10',
      activityName: '上海演唱会',
      ticketName: '看台A',
      quantity: 2,
      amount: 760,
      status: 2,
      createTime: '2026-06-01T09:30:00',
      attendees: [
        { id: 1, orderId: 10, attendeeUserProfileId: 501, realName: 'Alice', idType: 'ID_CARD', idNoMask: '110***********011', phone: null, status: 1 },
      ],
    },
  ] as OrderEntity[]

  const csv = buildConsoleOrderExportCsv(orders)

  assert.equal(csv.startsWith('\ufeff订单号,活动,票档,数量,金额,状态,观演人,下单时间'), true)
  assert.equal(csv.includes('O-10,上海演唱会,看台A,2,760,已支付,Alice 110***********011,2026-06-01T09:30:00'), true)
  assert.equal(csv.includes('110101199001010011'), false)
})

test('keeps selected console order export in table order', () => {
  const orders = [
    { id: 1, status: 2 },
    { id: 2, status: 3 },
    { id: 3, status: 2 },
  ] as OrderEntity[]

  assert.deepEqual(getSelectedConsoleOrders(orders, new Set([3, 1])).map(order => order.id), [1, 3])
  assert.deepEqual(filterConsoleOrdersByStatus(orders, 2).map(order => order.id), [1, 3])
})

test('describes organizer admin as a platform-side business role', () => {
  assert.equal(
    getConsoleOrderScopeCopy('organizer_admin'),
    '当前权限：主办方管理员岗位账号，可按权限查看平台主办方业务订单。',
  )
})
