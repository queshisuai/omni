import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildConsoleOrderExportCsv, filterConsoleOrdersByStatus, formatConsoleOrderStatusLabel, formatOrderAttendees, getConsoleOrderActivityLabel, getConsoleOrderScopeCopy, getConsoleOrderStatusClassName, getConsoleOrderTicketLabel, getSelectedConsoleOrders } from './console-orders.ts'
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

test('uses readable ticket fallback in console order displays and exports', () => {
  const order = {
    id: 11,
    orderNo: 'O-11',
    activityName: '上海演唱会',
    ticketName: null,
    ticketTypeId: 301,
    matchedTicketTypeId: null,
    quantity: 1,
    amount: 380,
    status: 2,
    createTime: '2026-06-01T09:30:00',
    attendees: [],
  } as unknown as OrderEntity

  const csv = buildConsoleOrderExportCsv([order])

  assert.equal(getConsoleOrderTicketLabel(order), '票档信息待同步')
  assert.match(csv, /票档信息待同步/)
  assert.doesNotMatch(csv, /票档 301/)
})

test('uses readable activity fallback in console order displays and exports', () => {
  const order = {
    id: 13,
    orderNo: 'O-13',
    activityName: '',
    ticketName: '看台A',
    quantity: 1,
    amount: 380,
    status: 2,
    createTime: '2026-06-01T09:30:00',
    attendees: [],
  } as unknown as OrderEntity

  const csv = buildConsoleOrderExportCsv([order])

  assert.equal(getConsoleOrderActivityLabel(order), '活动信息待同步')
  assert.match(csv, /活动信息待同步/)
  assert.doesNotMatch(csv, /未知活动/)
})

test('uses Chinese fallback for unknown console order status', () => {
  const order = {
    id: 12,
    orderNo: 'O-12',
    activityName: '上海演唱会',
    ticketName: '看台A',
    quantity: 1,
    amount: 380,
    status: 99,
    createTime: '2026-06-01T09:30:00',
    attendees: [],
  } as unknown as OrderEntity

  const csv = buildConsoleOrderExportCsv([order])

  assert.equal(formatConsoleOrderStatusLabel(99), '未知订单状态')
  assert.match(csv, /未知订单状态/)
  assert.doesNotMatch(csv, /,99,/)
})

test('uses a distinct review-needed style for unknown console order status', () => {
  assert.equal(getConsoleOrderStatusClassName(1), 'bg-[#fff8e1] text-[#f59e0b]')
  assert.equal(getConsoleOrderStatusClassName(2), 'bg-[#f0fff4] text-[#22c55e]')
  assert.equal(getConsoleOrderStatusClassName(3), 'bg-[#f5f5f5] text-[#999]')
  assert.equal(getConsoleOrderStatusClassName(4), 'bg-[#f5f5f5] text-[#999]')
  assert.equal(getConsoleOrderStatusClassName(99), 'bg-[#fff7e6] text-[#ad6800]')
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
    '当前权限：平台主办方运营员岗位账号，可按权限查看平台主办方业务订单。',
  )
})
