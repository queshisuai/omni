import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessConsolePath, canUseConsoleAction, canEnterConsole } from './console-auth.ts'

test('support manager can access support pages but not audit pages', () => {
  const permissions = ['support.conversation.view', 'support.account.manage']
  assert.equal(canAccessConsolePath('/console/support-accounts', permissions), true)
  assert.equal(canAccessConsolePath('/console/audit-logs', permissions), false)
})

test('organizer admin can only access own scope pages', () => {
  const permissions = ['activity.manage', 'station.review']
  assert.equal(canAccessConsolePath('/console/activities', permissions), true)
  assert.equal(canUseConsoleAction('station.review', permissions), true)
  assert.equal(canUseConsoleAction('refund.review', permissions), false)
})

test('support role can enter console when RBAC permissions allow it', () => {
  assert.equal(canEnterConsole('support', ['support.conversation.view']), true)
  assert.equal(canEnterConsole('support', []), false)
  assert.equal(canEnterConsole('user', ['support.conversation.view']), false)
})

test('organizer admin manages organizer accounts but not organizer business pages', () => {
  const permissions = ['organizer.account.manage']
  assert.equal(canEnterConsole('organizer_admin', permissions), true)
  assert.equal(canAccessConsolePath('/console/organizer-admins', permissions), true)
  assert.equal(canAccessConsolePath('/console/activities', permissions), false)
})
