import test from 'node:test'
import assert from 'node:assert/strict'

import { getConsoleQuickActions, isConsolePathAllowedForRole } from './console-paths.ts'

test('allows organizer business paths but blocks admin-only console paths', () => {
  assert.equal(isConsolePathAllowedForRole('organizer', '/console'), true)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/activities/1/marketing'), true)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/tours/2/stations/new'), true)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/venue'), true)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/venue/apply'), true)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/venue/applications'), false)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/venue/1/seats'), false)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/support-accounts'), false)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/support-conversations'), false)
  assert.equal(isConsolePathAllowedForRole('organizer', '/console/risk-cases'), false)
})

test('keeps admin console paths unrestricted and rejects non-console roles', () => {
  assert.equal(isConsolePathAllowedForRole('admin', '/console/support-accounts'), true)
  assert.equal(isConsolePathAllowedForRole('admin', '/console/venue/1/seats'), true)
  assert.equal(isConsolePathAllowedForRole('support', '/console'), false)
  assert.equal(isConsolePathAllowedForRole('user', '/console/orders'), false)
})

test('builds role-specific console quick actions', () => {
  assert.deepEqual(getConsoleQuickActions('organizer').map(item => item.href), [
    '/console/activities/new',
    '/console/activities',
    '/console/tours',
    '/console/venue',
    '/console/refunds',
    '/console/orders',
  ])
  assert.deepEqual(getConsoleQuickActions('admin').map(item => item.href), [
    '/console/activities/new',
    '/console/activities',
    '/console/tours',
    '/console/organizer-applications',
    '/console/roles',
    '/console/organizer-admins',
    '/console/support-accounts',
    '/console/support-conversations',
    '/console/audit-logs',
    '/console/exception-tasks',
    '/console/reconciliation',
    '/console/orders',
  ])
})
