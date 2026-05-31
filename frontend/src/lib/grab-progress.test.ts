import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getGrabProgressDisplayMessage, localizeGrabProgressMessage } from './grab-progress.ts'

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
