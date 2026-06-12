import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderDetailTimeline, formatOrderSeatLabel, getOrderDetailStatusCopy } from './orders-experience.ts'
import type { RefundRequestVO } from '../types/api.ts'

function refund(status: RefundRequestVO['status'], overrides: Partial<RefundRequestVO> = {}): RefundRequestVO {
  return {
    id: 1,
    orderId: 10,
    orderNo: 'O1',
    userId: 2004,
    paymentId: 99,
    refundNo: 'R1',
    amount: 380,
    reason: null,
    status,
    reviewerId: null,
    reviewNote: null,
    alipayRefundNo: null,
    createTime: '2026-06-01T10:30:00',
    reviewTime: null,
    refundTime: null,
    ...overrides,
  }
}

test('builds order detail timeline from order status', () => {
  const paid = buildOrderDetailTimeline({ status: 2, createTime: '2026-06-01T10:00:00' })

  assert.equal(paid[0].label, '提交订单')
  assert.equal(paid[0].state, 'done')
  assert.equal(paid[1].label, '支付成功')
  assert.equal(paid[1].state, 'done')
  assert.equal(paid[2].label, '出票入场')
  assert.equal(paid[2].state, 'active')
})

test('shows latest refund state in order detail timeline', () => {
  const reviewing = buildOrderDetailTimeline(
    { status: 2, createTime: '2026-06-01T10:00:00' },
    refund(0),
  )
  const processing = buildOrderDetailTimeline(
    { status: 2, createTime: '2026-06-01T10:00:00' },
    refund(4, { reviewTime: '2026-06-01T11:00:00' }),
  )
  const failed = buildOrderDetailTimeline(
    { status: 2, createTime: '2026-06-01T10:00:00' },
    refund(3, { reviewTime: '2026-06-01T11:00:00', refundTime: '2026-06-01T12:00:00' }),
  )
  const done = buildOrderDetailTimeline(
    { status: 4, createTime: '2026-06-01T10:00:00' },
    refund(1, { refundTime: '2026-06-01T12:00:00' }),
  )

  assert.deepEqual(reviewing.map((step) => [step.label, step.state]), [
    ['提交订单', 'done'],
    ['支付成功', 'done'],
    ['退款审核中', 'active'],
  ])
  assert.equal(processing[2].label, '退款处理中')
  assert.equal(processing[2].state, 'active')
  assert.equal(processing[2].time, '2026-06-01T11:00:00')
  assert.equal(failed[2].label, '退款失败')
  assert.equal(failed[2].state, 'failed')
  assert.equal(done[2].label, '退款完成')
  assert.equal(done[2].state, 'done')
  assert.equal(done[2].time, '2026-06-01T12:00:00')
})

test('formats order status copy for detail page', () => {
  assert.equal(getOrderDetailStatusCopy(1).title, '待支付')
  assert.equal(getOrderDetailStatusCopy(2).description, '订单已支付，可前往票夹查看电子票。')
  assert.equal(getOrderDetailStatusCopy(99).title, '订单状态更新中')
})

test('formats seatless paid orders as no fixed seat instead of generating', () => {
  const label = formatOrderSeatLabel({
    status: 2,
    seatLabels: null,
    seatSelectionMode: 'NONE',
  })

  assert.equal(label, '无固定座位，凭电子票入场')
})

test('keeps existing seat labels and gives pending seat orders a Chinese waiting copy', () => {
  assert.equal(formatOrderSeatLabel({ status: 2, seatLabels: 'A区 1排 08座', seatSelectionMode: 'EXPLICIT' }), 'A区 1排 08座')
  assert.equal(formatOrderSeatLabel({ status: 1, seatLabels: '', seatSelectionMode: 'EXPLICIT' }), '支付成功后确认座位信息')
})
