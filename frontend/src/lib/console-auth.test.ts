import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessConsolePath, canUseConsoleAction, canEnterConsole, getConsoleBrandLabel, getConsoleRoleLabel, getDefaultConsolePath, hasConsolePermission, shouldDefaultToConsoleAfterLogin } from './console-auth.ts'

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

test('support manager defaults to management console while plain support stays in workbench', () => {
  assert.equal(shouldDefaultToConsoleAfterLogin('support', ['support.conversation.view']), false)
  assert.equal(shouldDefaultToConsoleAfterLogin('support', ['support.account.manage']), true)
  assert.equal(getDefaultConsolePath('support', ['support.account.manage', 'support.conversation.view']), '/console/support-accounts')
  assert.equal(getDefaultConsolePath('support', ['audit.view']), '/console/audit-logs')
})

test('platform super admin role code can enter console without extra permissions', () => {
  assert.equal(canEnterConsole('platform_super_admin', []), true)
})

test('platform admin actions still require permission codes', () => {
  assert.equal(hasConsolePermission('platform_super_admin', [], 'activity.manage'), false)
  assert.equal(hasConsolePermission('platform_super_admin', ['activity.manage'], 'activity.manage'), true)
})

test('organizer admin manages organizer accounts but not organizer business pages', () => {
  const permissions = ['organizer.account.manage']
  assert.equal(canEnterConsole('organizer_admin', permissions), true)
  assert.equal(getDefaultConsolePath('organizer_admin', permissions), '/console/organizer-admins')
  assert.equal(canAccessConsolePath('/console/organizer-admins', permissions), true)
  assert.equal(canAccessConsolePath('/console/activities', permissions), false)
})

test('organizer admin default entry follows granted permissions', () => {
  assert.equal(getDefaultConsolePath('organizer_admin', ['activity.manage']), '/console/activities')
  assert.equal(getDefaultConsolePath('organizer_admin', ['tour.manage']), '/console/tours')
  assert.equal(getDefaultConsolePath('organizer_admin', ['order.view']), '/console/orders')
  assert.equal(getDefaultConsolePath('organizer_admin', ['organizer.account.manage', 'activity.manage']), '/console/activities')
  assert.equal(getDefaultConsolePath('organizer_admin', []), '/console')
})

test('formats console role and brand labels without mixing platform and scoped admins', () => {
  assert.equal(getConsoleRoleLabel('admin'), '平台管理员')
  assert.equal(getConsoleRoleLabel('platform_super_admin'), '平台超管')
  assert.equal(getConsoleRoleLabel('support', ['support.account.manage']), '客服主管')
  assert.equal(getConsoleRoleLabel('organizer_admin'), '主办方管理员')
  assert.equal(getConsoleBrandLabel('support', ['support.account.manage']), '客服管理后台')
  assert.equal(getConsoleBrandLabel('organizer_admin'), '主办方管理后台')
})
