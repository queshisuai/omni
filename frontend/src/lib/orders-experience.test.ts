import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderDetailTimeline, getOrderDetailStatusCopy } from './orders-experience.ts'

test('builds order detail timeline from order status', () => {
  const paid = buildOrderDetailTimeline({ status: 2, createTime: '2026-06-01T10:00:00' })

  assert.equal(paid[0].label, '提交订单')
  assert.equal(paid[0].state, 'done')
  assert.equal(paid[1].label, '支付成功')
  assert.equal(paid[1].state, 'done')
  assert.equal(paid[2].label, '出票入场')
  assert.equal(paid[2].state, 'active')
})

test('formats order status copy for detail page', () => {
  assert.equal(getOrderDetailStatusCopy(1).title, '待支付')
  assert.equal(getOrderDetailStatusCopy(2).description, '订单已支付，可前往票夹查看电子票。')
  assert.equal(getOrderDetailStatusCopy(99).title, '订单状态更新中')
})
