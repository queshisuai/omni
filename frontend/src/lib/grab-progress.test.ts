import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAutoDowngradeDisplay, getGrabProgressDisplayMessage, getQueueRankTrendLabel, localizeGrabProgressMessage } from './grab-progress.ts'

test('localizes pending recovery message for display', () => {
  assert.equal(
    getGrabProgressDisplayMessage({
      message: 'order confirmation pending',
      failReason: null,
      queueRank: null,
    }),
    '订单确认中，请稍后查看订单结果',
  )
})

test('localizes team pending recovery message for display', () => {
  assert.equal(
    getGrabProgressDisplayMessage({
      message: 'team order confirmation pending',
      failReason: null,
      queueRank: null,
    }),
    '小队订单确认中，请稍后查看订单结果',
  )
})

test('localizes sold out message for display', () => {
  assert.equal(
    getGrabProgressDisplayMessage({
      message: 'ticket type sold out',
      failReason: null,
      queueRank: null,
    }),
    '当前票档已售罄',
  )
})

test('localizes legacy locked creating order message for display', () => {
  assert.equal(
    getGrabProgressDisplayMessage({
      message: '普通票 locked, creating order',
      failReason: null,
      queueRank: null,
    }),
    '普通票已锁定，正在创建订单',
  )
})

test('keeps unknown display messages unchanged', () => {
  assert.equal(
    getGrabProgressDisplayMessage({
      message: '正在锁票',
      failReason: null,
      queueRank: null,
    }),
    '正在锁票',
  )
})

test('uses Chinese fallback for unknown English progress messages', () => {
  assert.equal(localizeGrabProgressMessage('backend timeout'), '抢票状态更新中，请稍后查看')
})

test('describes queue rank changes between refreshes', () => {
  assert.equal(getQueueRankTrendLabel(6, 9), '较上次前进 3 位')
  assert.equal(getQueueRankTrendLabel(12, 9), '较上次后退 3 位')
  assert.equal(getQueueRankTrendLabel(9, 9), '排位暂未变化')
  assert.equal(getQueueRankTrendLabel(null, 9), null)
})

test('describes auto downgrade state and matched ticket type', () => {
  assert.equal(getAutoDowngradeDisplay({
    allowAutoDowngrade: true,
    matchedTicketTypeId: 203,
    requestedTicketTypes: [
      { ticketTypeId: 202, name: 'A档' },
      { ticketTypeId: 203, name: 'B档' },
    ],
  }), '已自动降档至 B档')
  assert.equal(getAutoDowngradeDisplay({
    allowAutoDowngrade: true,
    matchedTicketTypeId: null,
    requestedTicketTypes: [{ ticketTypeId: 202, name: 'A档' }],
  }), '已开启，按票档顺序尝试')
  assert.equal(getAutoDowngradeDisplay({ allowAutoDowngrade: false, matchedTicketTypeId: null, requestedTicketTypes: [] }), '未开启自动降档')
})
