import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessConsolePath, canUseConsoleAction } from './console-auth'

test('support manager can access support pages but not audit pages', () => {
  const permissions = ['support.conversation.view', 'support.account.manage']
  assert.equal(canAccessConsolePath('/console/support-accounts', permissions), true)
  assert.equal(canAccessConsolePath('/console/audits', permissions), false)
})

test('organizer admin can only access own scope pages', () => {
  const permissions = ['activity.review', 'station.review']
  assert.equal(canUseConsoleAction('station.review', permissions), true)
  assert.equal(canUseConsoleAction('refund.review', permissions), false)
})
