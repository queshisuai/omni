import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatExceptionSeverity,
  formatExceptionStatus,
  getExceptionTaskTypeOptions,
  getOperationActionFilterOptions,
  getOperationTargetTypeFilterOptions,
  formatExceptionTaskType,
  formatOrganizerOpsAccountLabel,
  formatOperationAction,
  formatOperationTargetRef,
  formatOperationTargetType,
  formatOperatorRole,
  formatReconciliationBatchStatus,
  formatReconciliationBusinessType,
  formatReconciliationDetailStatus,
  formatReconciliationDifferenceStatus,
  formatReconciliationDiffType,
  formatReconciliationSource,
  formatReconciliationSummaryKey,
  formatStationConfigChangeType,
  formatStationConfigStatus,
  isClaimableExceptionStatus,
  isClosableExceptionStatus,
  isKnownReconciliationDifferenceStatus,
  isOpenExceptionStatus,
  isOpenReconciliationDifferenceStatus,
  isReviewableStationConfigStatus,
  isResolvableExceptionStatus,
} from './operation-display.ts'

test('formats operation audit codes as Chinese labels', () => {
  assert.equal(formatOperatorRole('platform_super_admin'), '平台超管')
  assert.equal(formatOperatorRole('support_manager'), '客服主管')
  assert.equal(formatOperatorRole('support_agent'), '普通客服')
  assert.equal(formatOperatorRole('organizer_admin'), '平台主办方运营员')
  assert.equal(formatOperatorRole('future_role'), '未知角色')

  assert.equal(formatOperationAction('organizer_admin.update'), '更新平台主办方运营员账号')
  assert.equal(formatOperationAction('organizer_admin.delete'), '删除平台主办方运营员账号')
  assert.equal(formatOperationAction('support.account.deactivate'), '停用客服账号')
  assert.equal(formatOperationAction('rbac.role_permission.update'), '更新角色权限')
  assert.equal(formatOperationAction('EXCEPTION_RESOLVE'), '处理异常任务')
  assert.equal(formatOperationAction('STATION_CONFIG_REVIEW'), '审核站点变更')
  assert.equal(formatOperationAction('VENUE_REVIEW'), '审核场馆资料')
  assert.equal(formatOperationAction('RISK_CASE_UPDATE'), '更新风险案例')
  assert.equal(formatOperationAction('organizer_ops.assignment.update'), '更新主办方运营分配')
  assert.equal(formatOperationAction('organizer_ops.follow_up.create'), '新增主办方跟进记录')
  assert.equal(formatOperationAction('exception_task.claim'), '认领异常任务')
  assert.equal(formatOperationAction('exception_task.close'), '关闭异常任务')
  assert.equal(formatOperationAction('reconciliation_difference.resolve'), '处理对账差异')
  assert.equal(formatOperationAction('activity.deactivate.refund'), '下架活动并退款')
  assert.equal(formatOperationAction('tour.deactivate.refund'), '下架巡演并退款')
  assert.equal(formatOperationAction('ticket_type.create'), '创建票档')
  assert.equal(formatOperationAction('ticket_type.update'), '更新票档')
  assert.equal(formatOperationAction('future.action'), '未知操作')

  assert.equal(formatOperationTargetType('user'), '用户')
  assert.equal(formatOperationTargetType('support_account'), '客服账号')
  assert.equal(formatOperationTargetType('organizer_ops_assignment'), '主办方运营分配')
  assert.equal(formatOperationTargetType('organizer_ops_follow_up'), '主办方跟进记录')
  assert.equal(formatOperationTargetType('rbac_role'), '角色')
  assert.equal(formatOperationTargetType('exception_task'), '异常任务')
  assert.equal(formatOperationTargetType('reconciliation_difference'), '对账差异')
  assert.equal(formatOperationTargetType('station_config_version'), '站点变更审核')
  assert.equal(formatOperationTargetType('venue_application'), '场馆资料审核')
  assert.equal(formatOperationTargetType('activity'), '活动')
  assert.equal(formatOperationTargetType('tour'), '巡演')
  assert.equal(formatOperationTargetType('artist'), '艺人档案')
  assert.equal(formatOperationTargetType('ticket_type'), '票档')
  assert.equal(formatOperationTargetType('future_target'), '未知对象')
  assert.equal(formatOperationTargetRef('user', '123123', null), '账号：123123')
  assert.equal(formatOperationTargetRef('rbac_role', 'support_manager', null), '角色：客服主管')
  assert.equal(formatOperationTargetRef('support_account', 'phone', null), '手机号')
  assert.equal(formatOperationTargetRef('support_account', null, 88), '客服账号编号：88')
  assert.equal(formatOperationTargetRef('organizer_ops_assignment', '2002', 2003), '负责人编号：2002')
  assert.equal(formatOperationTargetRef('organizer_ops_assignment', 'high', 2003), '风险等级：高风险')
  assert.equal(formatOperationTargetRef('organizer_ops_assignment', 'watch', 2003), '风险等级：关注')
  assert.equal(formatOperationTargetRef('organizer_ops_assignment', 'NOTE', 2003), '跟进类型：内部备注')
  assert.equal(formatOperationTargetRef('organizer_ops_follow_up', 'NOTE', 1), '跟进记录：内部备注')
  assert.equal(formatOperationTargetRef('unknown_target', null, 66), '对象编号：66')
  assert.equal(formatOrganizerOpsAccountLabel({ id: 2021, nickname: '主办方管理员', phone: '13800000002' }), '平台主办方运营员（编号：2021）')
  assert.equal(formatOrganizerOpsAccountLabel({ id: 2022, nickname: '', phone: '' }), '运营员编号：2022')
})

test('builds operation audit filter options with Chinese labels and backend values', () => {
  const actionOptions = getOperationActionFilterOptions()
  const targetTypeOptions = getOperationTargetTypeFilterOptions()

  assert.deepEqual(
    actionOptions.find(option => option.value === 'rbac.role_permission.update'),
    { value: 'rbac.role_permission.update', label: '更新角色权限' },
  )
  assert.deepEqual(
    actionOptions.find(option => option.value === 'ticket_type.update'),
    { value: 'ticket_type.update', label: '更新票档' },
  )
  assert.equal(actionOptions.some(option => option.label === 'rbac.role_permission.update'), false)

  assert.deepEqual(
    targetTypeOptions.find(option => option.value === 'rbac_role_permission'),
    { value: 'rbac_role_permission', label: '角色权限' },
  )
  assert.deepEqual(
    targetTypeOptions.find(option => option.value === 'ticket_type'),
    { value: 'ticket_type', label: '票档' },
  )
  assert.deepEqual(
    targetTypeOptions.find(option => option.value === 'artist'),
    { value: 'artist', label: '艺人档案' },
  )
  assert.equal(targetTypeOptions.some(option => option.label === 'ticket_type'), false)
})

test('formats exception task codes as Chinese labels', () => {
  assert.equal(formatExceptionTaskType('payment_abnormal'), '支付异常')
  assert.equal(formatExceptionTaskType('refund_failed'), '退款失败')
  assert.equal(formatExceptionTaskType('abnormal_refund'), '异常退款')
  assert.equal(formatExceptionTaskType('PAYMENT_TIMEOUT'), '支付超时')
  assert.equal(formatExceptionTaskType('REFUND_UNKNOWN'), '退款结果未知')
  assert.equal(formatExceptionTaskType('TICKET_ISSUE'), '出票异常')
  assert.equal(formatExceptionTaskType('STOCK_SYNC'), '库存同步异常')
  assert.equal(formatExceptionTaskType('RISK_REVIEW'), '风险复核')
  assert.equal(formatExceptionTaskType('RECONCILE_DIFF'), '对账差异')
  assert.equal(formatExceptionTaskType('FUTURE_TASK'), '未知异常类型')
  assert.equal(formatExceptionSeverity('high'), '高')
  assert.equal(formatExceptionSeverity('medium'), '中')
  assert.equal(formatExceptionSeverity('critical'), '未知等级')
  assert.equal(formatExceptionStatus('pending'), '待处理')
  assert.equal(formatExceptionStatus('resolved'), '已处理')
  assert.equal(formatExceptionStatus('closed'), '已关闭')
  assert.equal(formatExceptionStatus('queued'), '未知异常状态')
  assert.equal(isOpenExceptionStatus('pending'), true)
  assert.equal(isOpenExceptionStatus('processing'), true)
  assert.equal(isOpenExceptionStatus('resolved'), false)
  assert.equal(isOpenExceptionStatus('queued'), false)
  assert.equal(isClaimableExceptionStatus('pending'), true)
  assert.equal(isClaimableExceptionStatus('processing'), false)
  assert.equal(isClaimableExceptionStatus('queued'), false)
  assert.equal(isResolvableExceptionStatus('processing'), true)
  assert.equal(isResolvableExceptionStatus('pending'), false)
  assert.equal(isResolvableExceptionStatus('queued'), false)
  assert.equal(isClosableExceptionStatus('pending'), true)
  assert.equal(isClosableExceptionStatus('processing'), true)
  assert.equal(isClosableExceptionStatus('resolved'), false)
  assert.equal(isClosableExceptionStatus('queued'), false)
})

test('builds exception task type options from shared Chinese labels', () => {
  const taskTypeOptions = getExceptionTaskTypeOptions()

  assert.deepEqual(
    taskTypeOptions.find(option => option.value === 'PAYMENT_TIMEOUT'),
    { value: 'PAYMENT_TIMEOUT', label: '支付超时' },
  )
  assert.deepEqual(
    taskTypeOptions.find(option => option.value === 'refund_failed'),
    { value: 'refund_failed', label: '退款失败' },
  )
  assert.equal(taskTypeOptions.some(option => option.label === 'PAYMENT_TIMEOUT'), false)
})

test('formats station config and reconciliation backend keys as Chinese labels', () => {
  assert.equal(formatStationConfigChangeType('create'), '创建站点')
  assert.equal(formatStationConfigChangeType('change_schedule'), '调整场次时间')
  assert.equal(formatStationConfigChangeType('set_schedule'), '设置场次时间')
  assert.equal(formatStationConfigChangeType('change_venue'), '变更场馆')
  assert.equal(formatStationConfigChangeType('future_change_type'), '未知变更类型')
  assert.equal(formatStationConfigStatus('draft'), '草稿')
  assert.equal(formatStationConfigStatus('submitted'), '待审核')
  assert.equal(formatStationConfigStatus('approved'), '已通过')
  assert.equal(formatStationConfigStatus('applied'), '已应用')
  assert.equal(formatStationConfigStatus('rejected'), '已驳回')
  assert.equal(formatStationConfigStatus('withdrawn'), '已撤回')
  assert.equal(formatStationConfigStatus('future_status'), '未知配置状态')
  assert.equal(isReviewableStationConfigStatus('submitted'), true)
  assert.equal(isReviewableStationConfigStatus('approved'), false)
  assert.equal(isReviewableStationConfigStatus('future_status'), false)

  assert.equal(formatReconciliationBatchStatus('generated'), '已生成')
  assert.equal(formatReconciliationBatchStatus('processing'), '处理中')
  assert.equal(formatReconciliationBatchStatus('unknown_status'), '未知对账批次状态')
  assert.equal(formatReconciliationDetailStatus('matched'), '已匹配')
  assert.equal(formatReconciliationDetailStatus('different'), '存在差异')
  assert.equal(formatReconciliationDetailStatus('future_detail'), '未知对账明细状态')
  assert.equal(formatReconciliationDifferenceStatus('open'), '待处理')
  assert.equal(formatReconciliationDifferenceStatus('future_difference'), '未知对账差异状态')
  assert.equal(isKnownReconciliationDifferenceStatus('open'), true)
  assert.equal(isKnownReconciliationDifferenceStatus('resolved'), true)
  assert.equal(isKnownReconciliationDifferenceStatus('ignored'), true)
  assert.equal(isKnownReconciliationDifferenceStatus('future_difference'), false)
  assert.equal(isOpenReconciliationDifferenceStatus('open'), true)
  assert.equal(isOpenReconciliationDifferenceStatus('resolved'), false)
  assert.equal(isOpenReconciliationDifferenceStatus('future_difference'), false)
  assert.equal(formatReconciliationSource('local'), '本地日结')
  assert.equal(formatReconciliationSource('future_channel'), '未知来源')
  assert.equal(formatReconciliationBusinessType('refund'), '退款')
  assert.equal(formatReconciliationBusinessType('ORDER'), '订单')
  assert.equal(formatReconciliationBusinessType('REFUND'), '退款')
  assert.equal(formatReconciliationBusinessType('future_biz'), '未知业务类型')
  assert.equal(formatReconciliationDiffType('amount_mismatch'), '金额不一致')
  assert.equal(formatReconciliationDiffType('REFUND_AMOUNT_MISMATCH'), '退款金额不一致')
  assert.equal(formatReconciliationDiffType('future_diff'), '未知差异类型')

  assert.equal(formatReconciliationSummaryKey('paidOrderCount'), '已支付订单数')
  assert.equal(formatReconciliationSummaryKey('refundAbnormalCount'), '退款异常数')
  assert.equal(formatReconciliationSummaryKey('diffCount'), '差异数')
  assert.equal(formatReconciliationSummaryKey('paymentAmount'), '支付金额')
  assert.equal(formatReconciliationSummaryKey('业务日期'), '业务日期')
  assert.equal(formatReconciliationSummaryKey('支付笔数'), '支付笔数')
  assert.equal(formatReconciliationSummaryKey('支付金额'), '支付金额')
  assert.equal(formatReconciliationSummaryKey('退款笔数'), '退款笔数')
  assert.equal(formatReconciliationSummaryKey('退款金额'), '退款金额')
  assert.equal(formatReconciliationSummaryKey('净额'), '净额')
  assert.equal(formatReconciliationSummaryKey('差异数'), '差异数')
  assert.equal(formatReconciliationSummaryKey('summary'), '摘要')
  assert.equal(formatReconciliationSummaryKey('futureMetricCount'), '其他指标')
})
