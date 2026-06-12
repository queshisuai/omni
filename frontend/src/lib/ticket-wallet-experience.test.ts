import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTicketWalletStatusCopy } from './ticket-wallet-experience.ts'
import type { TicketTransferCreateVO, TicketWalletItemVO } from '../types/api.ts'

function ticket(status: number, overrides: Partial<TicketWalletItemVO> = {}): TicketWalletItemVO {
  return {
    ticketId: 1,
    ticketNo: 'T1',
    orderId: 980057,
    sessionId: 100,
    ticketTypeId: 200,
    activityName: '测试演出',
    venueName: '测试场馆',
    sessionTime: '2026-06-12T19:30:00',
    ticketName: '看台票',
    seatLabel: 'A-1',
    realName: '张三',
    idNoMask: '110***********001X',
    status,
    statusText: null,
    checkedInAt: null,
    ...overrides,
  }
}

function transfer(overrides: Partial<TicketTransferCreateVO> = {}): TicketTransferCreateVO {
  return {
    transferId: 9,
    ticketId: 1,
    transferCode: 'ABC123',
    status: 1,
    statusText: null,
    expiresAt: '2026-06-12T18:30:00',
    ...overrides,
  }
}

test('explains unused ticket entry and transfer availability in Chinese', () => {
  const copy = getTicketWalletStatusCopy(ticket(1))

  assert.equal(copy.title, '可入场')
  assert.match(copy.description, /可生成入场码/)
  assert.match(copy.description, /如需转赠/)
})

test('explains active transfer before entry code action', () => {
  const copy = getTicketWalletStatusCopy(ticket(1), transfer())

  assert.equal(copy.title, '转赠中')
  assert.match(copy.description, /好友领取前/)
  assert.match(copy.description, /撤回/)
})

test('explains checked, invalid and transferred tickets without raw status codes', () => {
  assert.equal(getTicketWalletStatusCopy(ticket(2, { checkedInAt: '2026-06-12T19:05:00' })).title, '已完成核验')
  assert.match(getTicketWalletStatusCopy(ticket(3)).description, /订单取消、退款或票券状态变更/)
  assert.match(getTicketWalletStatusCopy(ticket(4)).description, /不能再用于入场/)
  assert.equal(getTicketWalletStatusCopy(ticket(99)).title, '状态同步中')
})
