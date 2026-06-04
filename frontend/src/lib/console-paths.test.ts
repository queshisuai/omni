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

test('does not use platform admin role as a permission-code bypass', () => {
  assert.equal(isConsolePathAllowedForRole('admin', '/console'), true)
  assert.equal(isConsolePathAllowedForRole('admin', '/console/profile'), true)
  assert.equal(isConsolePathAllowedForRole('admin', '/console/support-accounts'), false)
  assert.equal(isConsolePathAllowedForRole('admin', '/console/venue/1/seats'), false)
  assert.equal(isConsolePathAllowedForRole('platform_super_admin', '/console/support-accounts'), false)
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
  assert.deepEqual(getConsoleQuickActions('admin').map(item => item.href), [])
  assert.deepEqual(getConsoleQuickActions('admin', [
    'activity.manage',
    'tour.manage',
    'organizer.review',
    'rbac.manage',
    'organizer.account.manage',
    'support.account.manage',
    'support.conversation.view',
    'audit.view',
    'compensation.execute',
    'reconcile.view',
    'order.view',
  ]).map(item => item.href), [
    '/console/activities',
    '/console/tours',
    '/console/orders',
    '/console/organizer-applications',
    '/console/organizer-admins',
    '/console/support-accounts',
    '/console/support-conversations',
    '/console/audit-logs',
    '/console/exception-tasks',
    '/console/reconciliation',
    '/console/roles',
  ])
  assert.deepEqual(getConsoleQuickActions('organizer_admin').map(item => item.href), [
    '/console/profile',
  ])
  assert.deepEqual(getConsoleQuickActions('organizer_admin', ['organizer.account.manage']).map(item => item.href), [
    '/console/organizer-admins',
    '/console/profile',
  ])
  assert.deepEqual(getConsoleQuickActions('organizer_admin', ['activity.manage', 'tour.manage', 'order.view']).map(item => item.href), [
    '/console/activities',
    '/console/tours',
    '/console/orders',
    '/console/profile',
  ])
  assert.deepEqual(getConsoleQuickActions('support', ['support.account.manage', 'support.conversation.view', 'audit.view']).map(item => item.href), [
    '/console/support-accounts',
    '/console/support-conversations',
    '/console/audit-logs',
    '/console/profile',
  ])
})
