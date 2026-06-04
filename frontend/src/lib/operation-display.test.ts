import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatExceptionSeverity,
  formatExceptionStatus,
  formatExceptionTaskType,
  formatOperationAction,
  formatOperationTargetRef,
  formatOperationTargetType,
  formatOperatorRole,
} from './operation-display.ts'

test('formats operation audit codes as Chinese labels', () => {
  assert.equal(formatOperatorRole('platform_super_admin'), '平台超管')
  assert.equal(formatOperatorRole('support_manager'), '客服主管')
  assert.equal(formatOperatorRole('support_agent'), '普通客服')
  assert.equal(formatOperatorRole('organizer_admin'), '主办方管理员')

  assert.equal(formatOperationAction('organizer_admin.update'), '更新主办方管理员账号')
  assert.equal(formatOperationAction('organizer_admin.delete'), '删除主办方管理员账号')
  assert.equal(formatOperationAction('support.account.deactivate'), '停用客服账号')
  assert.equal(formatOperationAction('rbac.role_permission.update'), '更新角色权限')

  assert.equal(formatOperationTargetType('user'), '用户')
  assert.equal(formatOperationTargetType('support_account'), '客服账号')
  assert.equal(formatOperationTargetType('rbac_role'), '角色')
  assert.equal(formatOperationTargetRef('user', '123123', null), '账号：123123')
  assert.equal(formatOperationTargetRef('rbac_role', 'support_manager', null), '角色：客服主管')
  assert.equal(formatOperationTargetRef('support_account', 'phone', null), '手机号')
  assert.equal(formatOperationTargetRef('support_account', null, 88), 'ID：88')
})

test('formats exception task codes as Chinese labels', () => {
  assert.equal(formatExceptionTaskType('payment_abnormal'), '支付异常')
  assert.equal(formatExceptionTaskType('refund_failed'), '退款失败')
  assert.equal(formatExceptionTaskType('abnormal_refund'), '异常退款')
  assert.equal(formatExceptionSeverity('high'), '高')
  assert.equal(formatExceptionSeverity('medium'), '中')
  assert.equal(formatExceptionStatus('pending'), '待处理')
  assert.equal(formatExceptionStatus('resolved'), '已处理')
})
