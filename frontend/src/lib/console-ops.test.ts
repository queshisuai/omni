import test from 'node:test'
import assert from 'node:assert/strict'
import { canLoadPlatformOpsSummary } from './console-ops.ts'

test('loads platform operation summary only when all operation permissions exist', () => {
  const permissions = ['compensation.execute', 'reconcile.view', 'audit.view']
  assert.equal(canLoadPlatformOpsSummary('platform_super_admin', permissions), true)
  assert.equal(canLoadPlatformOpsSummary('admin', []), false)
  assert.equal(canLoadPlatformOpsSummary('support', ['audit.view']), false)
  assert.equal(canLoadPlatformOpsSummary('organizer', ['refund.review']), false)
  assert.equal(canLoadPlatformOpsSummary('organizer_admin', ['audit.view']), false)
})
