import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as consoleRefunds from './console-refunds.ts'
import {
  buildConsoleRefundExportCsv,
  buildConsoleRefundExportExcelHtml,
  canReviewConsoleRefund,
  formatConsoleRefundActionLabel,
  getBatchRefundApproveTargets,
  getBatchRefundRejectTargets,
  getConsoleRefundActivityLabel,
  getConsoleRefundStatusClassName,
} from './console-refunds.ts'
import type { RefundRequestVO } from '../types/api.ts'

test('builds refund csv without internal or sensitive identifiers', () => {
  const refunds = [
    {
      id: 10,
      orderId: 980057,
      orderNo: 'DM202606110001',
      activityName: '上海演唱会',
      orderName: null,
      userId: 2004,
      paymentId: 8801,
      refundNo: 'RF202606110001',
      amount: 199,
      reason: '用户,临时有事',
      status: 1,
      reviewerId: 2002,
      reviewNote: '同意退款',
      alipayRefundNo: 'ALIPAY-REFUND-SECRET',
      createTime: '2026-06-11T10:00:00',
      reviewTime: '2026-06-11T10:05:00',
      refundTime: '2026-06-11T10:10:00',
    },
  ] as RefundRequestVO[]

  const csv = buildConsoleRefundExportCsv(refunds)

  assert.equal(csv.startsWith('\ufeff退款号,订单号,活动,金额,状态,原因,申请时间,审核时间,到账时间'), true)
  assert.match(csv, /RF202606110001,DM202606110001,上海演唱会,199,已退款,"用户,临时有事"/)
  assert.doesNotMatch(csv, /2004|8801|2002|ALIPAY-REFUND-SECRET|980057/)
})

test('builds refund excel html without internal or sensitive identifiers', () => {
  const refunds = [
    {
      id: 10,
      orderId: 980057,
      orderNo: 'DM202606110001',
      activityName: '上海演唱会',
      orderName: '周末专场 <A>',
      userId: 2004,
      paymentId: 8801,
      refundNo: 'RF202606110001',
      amount: 199,
      reason: '用户临时有事 & 不能到场',
      status: 4,
      reviewerId: 2002,
      reviewNote: '处理中',
      alipayRefundNo: 'ALIPAY-REFUND-SECRET',
      createTime: '2026-06-11T10:00:00',
      reviewTime: '2026-06-11T10:05:00',
      refundTime: null,
    },
  ] as RefundRequestVO[]

  const html = buildConsoleRefundExportExcelHtml(refunds)

  assert.match(html, /<table>/)
  assert.match(html, /<th>退款号<\/th>/)
  assert.match(html, /<td>RF202606110001<\/td>/)
  assert.match(html, /<td>周末专场 &lt;A&gt;<\/td>/)
  assert.match(html, /用户临时有事 &amp; 不能到场/)
  assert.match(html, /<td>处理中<\/td>/)
  assert.doesNotMatch(html, /2004|8801|2002|ALIPAY-REFUND-SECRET|980057/)
})

test('uses business-specific fallback for unknown refund status in exports', () => {
  const refunds = [
    {
      id: 11,
      orderId: 980058,
      orderNo: 'DM202606110002',
      activityName: '北京演唱会',
      orderName: null,
      userId: 2004,
      paymentId: 8802,
      refundNo: 'RF202606110002',
      amount: 299,
      reason: '状态同步中',
      status: 99,
      reviewerId: null,
      reviewNote: null,
      alipayRefundNo: null,
      createTime: '2026-06-11T11:00:00',
      reviewTime: null,
      refundTime: null,
    },
  ] as unknown as RefundRequestVO[]

  assert.match(buildConsoleRefundExportCsv(refunds), /未知退款状态/)
  assert.match(buildConsoleRefundExportExcelHtml(refunds), /未知退款状态/)
})

test('uses readable activity fallback for refund exports', () => {
  const refunds = [
    {
      id: 12,
      orderId: 980059,
      orderNo: 'DM202606110003',
      activityName: '',
      orderName: null,
      userId: 2004,
      paymentId: 8803,
      refundNo: 'RF202606110003',
      amount: 399,
      reason: '活动同步中',
      status: 0,
      reviewerId: null,
      reviewNote: null,
      alipayRefundNo: null,
      createTime: '2026-06-11T12:00:00',
      reviewTime: null,
      refundTime: null,
    },
  ] as unknown as RefundRequestVO[]

  const csv = buildConsoleRefundExportCsv(refunds)
  const html = buildConsoleRefundExportExcelHtml(refunds)

  assert.equal(getConsoleRefundActivityLabel(refunds[0]), '活动信息待同步')
  assert.match(csv, /活动信息待同步/)
  assert.match(html, /活动信息待同步/)
  assert.doesNotMatch(csv, /未知活动/)
  assert.doesNotMatch(html, /未知活动/)
})

test('uses review-needed style for unknown refund status badges', () => {
  assert.equal(getConsoleRefundStatusClassName(0), 'bg-[#fff8e1] text-[#f59e0b]')
  assert.equal(getConsoleRefundStatusClassName(1), 'bg-[#f0fff4] text-[#22c55e]')
  assert.equal(getConsoleRefundStatusClassName(2), 'bg-[#f5f5f5] text-[#777]')
  assert.equal(getConsoleRefundStatusClassName(3), 'bg-[#fff1f2] text-[#e11d48]')
  assert.equal(getConsoleRefundStatusClassName(4), 'bg-[#e3f2fd] text-[#2563eb]')
  assert.equal(getConsoleRefundStatusClassName(99 as RefundRequestVO['status']), 'bg-[#fff7e6] text-[#ad6800]')
})

test('keeps unknown refund status out of review actions with a review-needed label', () => {
  assert.equal(canReviewConsoleRefund(0), true)
  assert.equal(canReviewConsoleRefund(4), true)
  assert.equal(canReviewConsoleRefund(1), false)
  assert.equal(canReviewConsoleRefund(99 as RefundRequestVO['status']), false)
  assert.equal(formatConsoleRefundActionLabel(1), '无需操作')
  assert.equal(formatConsoleRefundActionLabel(99 as RefundRequestVO['status']), '状态待核对')
})

test('filters batch refund targets by safe review status', () => {
  const refunds = [
    { id: 1, status: 0 },
    { id: 2, status: 4 },
    { id: 3, status: 1 },
    { id: 4, status: 99 },
  ] as RefundRequestVO[]

  assert.deepEqual(getBatchRefundApproveTargets(refunds).map(refund => refund.id), [1, 2])
  assert.deepEqual(getBatchRefundRejectTargets(refunds).map(refund => refund.id), [1])
})

test('guards single refund review actions by action-specific status', () => {
  assert.equal(typeof consoleRefunds.canApplyConsoleRefundReviewAction, 'function')
  const canApplyConsoleRefundReviewAction = consoleRefunds.canApplyConsoleRefundReviewAction

  assert.equal(canApplyConsoleRefundReviewAction(0, 'approve'), true)
  assert.equal(canApplyConsoleRefundReviewAction(4, 'approve'), true)
  assert.equal(canApplyConsoleRefundReviewAction(0, 'reject'), true)
  assert.equal(canApplyConsoleRefundReviewAction(4, 'reject'), false)
  assert.equal(canApplyConsoleRefundReviewAction(1, 'approve'), false)
  assert.equal(canApplyConsoleRefundReviewAction(99 as RefundRequestVO['status'], 'approve'), false)
})
