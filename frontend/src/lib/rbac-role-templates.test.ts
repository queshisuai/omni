import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRbacRoleTemplatesForRole } from './rbac-role-templates.ts'

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
  assert.deepEqual(templates[0].missingPermissionCodes, ['audit.view'])
})

test('does not offer templates for platform super admin role', () => {
  const templates = getRbacRoleTemplatesForRole('platform_super_admin', [
    'rbac.manage',
    'audit.view',
  ])

  assert.deepEqual(templates, [])
})
