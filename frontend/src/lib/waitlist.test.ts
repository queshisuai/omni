import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canCancelWaitlistEntry,
  canJoinWaitlistFromGrabStatus,
  getWaitlistChanceStyle,
  getWaitlistEntryDisplay,
  getWaitlistPrimaryAction,
  getWaitlistStatusLabel,
} from './waitlist.ts'
import type { WaitlistEntryVO } from '@/types/api'

function makeEntry(overrides: Partial<WaitlistEntryVO> = {}): WaitlistEntryVO {
  return {
    id: 1,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    status: 'WAITING',
    rank: 3,
    estimatedChance: 'HIGH',
    estimatedChanceText: '机会较高',
    estimatedWaitText: '排位靠前，释放票后会优先通知',
    offerOrderId: null,
    offerExpireTime: null,
    failReason: null,
    ...overrides,
  }
}

test('enables waitlist entry for sold-out grab terminal states', () => {
  assert.equal(canJoinWaitlistFromGrabStatus('SOLD_OUT'), true)
  assert.equal(canJoinWaitlistFromGrabStatus('FAILED'), true)
  assert.equal(canJoinWaitlistFromGrabStatus('LIMITED'), true)
  assert.equal(canJoinWaitlistFromGrabStatus('ORDER_CREATED'), false)
  assert.equal(canJoinWaitlistFromGrabStatus('PENDING_RECOVERY'), false)
  assert.equal(canJoinWaitlistFromGrabStatus(null), false)
})

test('returns readable waitlist status labels', () => {
  assert.equal(getWaitlistStatusLabel('WAITING'), '候补中')
  assert.equal(getWaitlistStatusLabel('ALLOCATING'), '分配中')
  assert.equal(getWaitlistStatusLabel('OFFERED'), '待支付')
  assert.equal(getWaitlistStatusLabel('PAID'), '已支付')
  assert.equal(getWaitlistStatusLabel('UNKNOWN'), '候补状态同步中')
})

test('only waiting entries can be cancelled by users', () => {
  assert.equal(canCancelWaitlistEntry('WAITING'), true)
  assert.equal(canCancelWaitlistEntry('ALLOCATING'), false)
  assert.equal(canCancelWaitlistEntry('OFFERED'), false)
  assert.equal(canCancelWaitlistEntry('PAID'), false)
})

test('returns primary waitlist action for user list page', () => {
  assert.equal(getWaitlistPrimaryAction('WAITING', null), '取消候补')
  assert.equal(getWaitlistPrimaryAction('OFFERED', 88), '去支付')
  assert.equal(getWaitlistPrimaryAction('OFFERED', null), null)
  assert.equal(getWaitlistPrimaryAction('PAID', 88), null)
})

test('returns chance styles for waitlist opportunity display', () => {
  assert.equal(getWaitlistChanceStyle('HIGH'), 'border-[#52c41a]/20 bg-[#f6ffed] text-[#389e0d]')
  assert.equal(getWaitlistChanceStyle('MEDIUM'), 'border-[#faad14]/30 bg-[#fff7e6] text-[#ad6800]')
  assert.equal(getWaitlistChanceStyle('LOW'), 'border-[#ddd] bg-[#f7f7f7] text-[#777]')
})

test('builds readable waitlist display from ticket context before ids', () => {
  const display = getWaitlistEntryDisplay(makeEntry({
    activityName: '周末演唱会',
    ticketTypeName: '看台 A',
    venueName: '万象体育馆',
    sessionTime: '2026-07-18T19:30:00',
  }))

  assert.equal(display.title, '周末演唱会')
  assert.deepEqual(display.meta, ['2026-07-18 19:30', '看台 A', '万象体育馆', '数量：1'])
  assert.equal(display.meta.join(' ').includes('场次 101'), false)
  assert.equal(display.meta.join(' ').includes('票档 202'), false)
})

test('falls back to synchronization labels instead of opaque ids when waitlist context is missing', () => {
  const display = getWaitlistEntryDisplay(makeEntry())

  assert.equal(display.title, '活动信息同步中')
  assert.deepEqual(display.meta, ['票档信息同步中', '数量：1'])
  assert.equal(display.meta.join(' ').includes('101'), false)
  assert.equal(display.meta.join(' ').includes('202'), false)
})
