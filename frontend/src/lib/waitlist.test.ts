import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canCancelWaitlistEntry, canJoinWaitlistFromGrabStatus, getWaitlistPrimaryAction, getWaitlistStatusLabel } from './waitlist.ts'

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
  assert.equal(getWaitlistStatusLabel('UNKNOWN'), '未知状态')
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
