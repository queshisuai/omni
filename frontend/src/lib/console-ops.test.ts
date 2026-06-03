import test from 'node:test'
import assert from 'node:assert/strict'
import { canLoadPlatformOpsSummary } from './console-ops.ts'

test('loads platform operation summary only for platform admin roles', () => {
  assert.equal(canLoadPlatformOpsSummary('admin'), true)
  assert.equal(canLoadPlatformOpsSummary('platform_super_admin'), true)
  assert.equal(canLoadPlatformOpsSummary('support'), false)
  assert.equal(canLoadPlatformOpsSummary('organizer'), false)
  assert.equal(canLoadPlatformOpsSummary('organizer_admin'), false)
})
