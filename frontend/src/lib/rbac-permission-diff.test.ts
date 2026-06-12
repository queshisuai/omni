import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildRbacPermissionDiff, formatRbacPermissionDiffList } from './rbac-permission-diff.ts'

test('builds role permission change preview with readable permission names', () => {
  const diff = buildRbacPermissionDiff(
    ['support.conversation.view', 'audit.view'],
    ['support.conversation.view', 'support.account.manage'],
    new Map([
      ['audit.view', '操作审计'],
      ['support.account.manage', '客服账号管理'],
    ]),
  )

  assert.equal(diff.hasChanges, true)
  assert.equal(diff.hasSensitiveChanges, false)
  assert.deepEqual(diff.added, [{ code: 'support.account.manage', name: '客服账号管理' }])
  assert.deepEqual(diff.removed, [{ code: 'audit.view', name: '操作审计' }])
  assert.equal(formatRbacPermissionDiffList(diff.added), '客服账号管理（support.account.manage）')
  assert.equal(formatRbacPermissionDiffList(diff.removed), '操作审计（audit.view）')
})

test('marks rbac manage and platform super admin permission changes as sensitive', () => {
  const removedManage = buildRbacPermissionDiff(['rbac.manage'], [], new Map([['rbac.manage', '角色权限管理']]))
  const platformRoleChange = buildRbacPermissionDiff([], ['audit.view'], new Map(), { roleCode: 'platform_super_admin' })

  assert.equal(removedManage.hasSensitiveChanges, true)
  assert.equal(platformRoleChange.hasSensitiveChanges, true)
})
