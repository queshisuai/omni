import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRbacRoleTemplatesForRole } from './rbac-role-templates.ts'
import {
  groupRbacPermissionsByDomain,
  isRootLockedPermission,
  orderRbacRoles,
  RBAC_PERMISSION_DOMAINS,
  ROLE_ORDER,
  ROOT_LOCK_TOOLTIP,
} from './rbac-permission-groups.ts'

test('builds support manager role template from available permissions only', () => {
  const templates = getRbacRoleTemplatesForRole('support_manager', [
    'support.account.manage',
    'support.conversation.view',
  ])

  assert.equal(templates.length, 1)
  assert.equal(templates[0].name, '客服主管标准模板')
  assert.deepEqual(templates[0].permissionCodes, [
    'support.account.manage',
    'support.conversation.view',
  ])
  assert.deepEqual(templates[0].missingPermissionCodes, [
    'cs.manage',
    'cs.review',
    'order.view',
    'refund.review',
    'risk.view',
    'audit.view',
  ])
})

test('offers full available permission template for platform super admin role', () => {
  const templates = getRbacRoleTemplatesForRole('platform_super_admin', [
    'activity.manage',
    'audit.view',
    'rbac.manage',
  ])

  assert.equal(templates.length, 1)
  assert.equal(templates[0].name, '平台超管全权限模板')
  assert.deepEqual(templates[0].permissionCodes, ['activity.manage', 'rbac.manage', 'audit.view'])
})

test('orders platform super admin first and keeps approved role order', () => {
  const roles = orderRbacRoles([
    { code: 'support_agent', name: '普通客服', status: 1, permissionCodes: [] },
    { code: 'organizer', name: '主办方主账号', status: 1, permissionCodes: [] },
    { code: 'platform_super_admin', name: '平台超管', status: 1, permissionCodes: [] },
    { code: 'support_manager', name: '客服主管', status: 1, permissionCodes: [] },
    { code: 'organizer_admin', name: '平台主办方运营员', status: 1, permissionCodes: [] },
  ])

  assert.deepEqual(ROLE_ORDER, [
    'platform_super_admin',
    'organizer',
    'organizer_admin',
    'support_manager',
    'support_agent',
  ])
  assert.deepEqual(roles.map(role => role.code), ROLE_ORDER)
})

test('groups all rbac permission codes into four business domains without other bucket', () => {
  const permissionCodes = [
    'activity.manage',
    'session.manage',
    'tour.manage',
    'venue.manage',
    'venue.review',
    'station.review',
    'artist.manage',
    'activity.review.manage',
    'order.view',
    'refund.review',
    'checkin.view',
    'checkin.sync',
    'checkin.device.manage',
    'compensation.execute',
    'organizer.review',
    'organizer.follow.manage',
    'organizer.account.manage',
    'organizer.assign.manage',
    'cs.manage',
    'cs.review',
    'support.conversation.view',
    'support.account.manage',
    'risk.view',
    'risk.review',
    'rbac.manage',
    'audit.view',
    'reconcile.view',
  ]
  const grouped = groupRbacPermissionsByDomain(permissionCodes.map(code => ({ code, name: code })))

  assert.deepEqual(grouped.map(group => group.title), RBAC_PERMISSION_DOMAINS.map(group => group.title))
  assert.equal(grouped.flatMap(group => group.items).length, 27)
  assert.equal(grouped.some(group => group.title === '其他'), false)
  assert.equal(grouped.find(group => group.key === 'ticket')?.items.some(item => item.code === 'session.manage'), true)
  assert.equal(grouped.find(group => group.key === 'fulfillment')?.items.some(item => item.code === 'checkin.sync'), true)
  assert.equal(grouped.find(group => group.key === 'operations')?.items.some(item => item.code === 'cs.manage'), true)
  assert.equal(grouped.find(group => group.key === 'governance')?.items.some(item => item.code === 'audit.view'), true)
})

test('root lock protection only targets platform super admin rbac manage permission', () => {
  assert.equal(isRootLockedPermission('platform_super_admin', 'rbac.manage'), true)
  assert.equal(isRootLockedPermission('platform_super_admin', 'activity.manage'), false)
  assert.equal(isRootLockedPermission('organizer_admin', 'rbac.manage'), false)
  assert.match(ROOT_LOCK_TOOLTIP, /核心自保权限/)
  assert.match(ROOT_LOCK_TOOLTIP, /不可取消/)
})
