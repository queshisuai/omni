import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countConsoleOrdersByStatus,
  filterConsoleOrdersByStatus,
  getConsoleOrderScopeCopy,
  paginateConsoleOrders,
} from './console-orders.ts'
import type { OrderEntity } from '../types/api.ts'

function order(id: number, status: number): OrderEntity {
  return {
    id,
    orderNo: `NO-${id}`,
    userId: 2002,
    sessionId: 1,
    ticketTypeId: 1,
    quantity: 1,
    amount: 100,
    status,
    createTime: '2026-05-29T00:00:00',
  }
}

test('filters console orders by the visible status tabs', () => {
  const orders = [order(1, 1), order(2, 2), order(3, 3), order(4, 4), order(5, 2)]

  assert.deepEqual(filterConsoleOrdersByStatus(orders, 'all').map(item => item.id), [1, 2, 3, 4, 5])
  assert.deepEqual(filterConsoleOrdersByStatus(orders, 2).map(item => item.id), [2, 5])
  assert.deepEqual(filterConsoleOrdersByStatus(orders, 4).map(item => item.id), [4])
  assert.deepEqual(filterConsoleOrdersByStatus(orders, 3).map(item => item.id), [3])
})

test('counts orders for all, paid, refunded, and cancelled tabs', () => {
  const orders = [order(1, 1), order(2, 2), order(3, 3), order(4, 4), order(5, 2)]

  assert.deepEqual(countConsoleOrdersByStatus(orders), {
    all: 5,
    paid: 2,
    refunded: 1,
    cancelled: 1,
  })
})

test('paginates filtered console orders and clamps out-of-range pages', () => {
  const orders = [order(1, 2), order(2, 2), order(3, 2), order(4, 2), order(5, 2)]

  assert.deepEqual(paginateConsoleOrders(orders, 2, 2), {
    currentPage: 2,
    totalPages: 3,
    pageOrders: [orders[2], orders[3]],
  })
  assert.equal(paginateConsoleOrders(orders, 99, 2).currentPage, 3)
  assert.equal(paginateConsoleOrders(orders, 0, 2).currentPage, 1)
})

test('describes console order visibility by current role', () => {
  assert.equal(getConsoleOrderScopeCopy('admin'), '当前权限：平台管理员，可查看全部活动订单。')
  assert.equal(getConsoleOrderScopeCopy('organizer'), '当前权限：主办方，仅查看自己活动产生的订单。')
})
