const ROLE_LABELS: Record<string, string> = {
  platform_super_admin: '平台超管',
  admin: '平台管理员',
  organizer: '活动主办方',
  organizer_admin: '平台主办方运营员',
  support: '客服账号',
  support_manager: '客服主管',
  support_agent: '普通客服',
  user: '普通用户',
  unknown: '未知角色',
}

const OPERATION_ACTION_LABELS: Record<string, string> = {
  ACTIVITY_PUBLISH: '发布活动',
  TOUR_DRAFT_UPDATE: '更新巡演草稿',
  ARTIST_REVIEW: '审核艺人档案',
  RISK_RESOLUTION_REVIEW: '审核恢复售票申请',
  RISK_CASE_UPDATE: '更新风险案例',
  VENUE_REVIEW: '审核场馆资料',
  STATION_CONFIG_REVIEW: '审核站点变更',
  EXCEPTION_RESOLVE: '处理异常任务',
  'rbac.role_permission.update': '更新角色权限',
  'organizer_admin.create': '创建平台主办方运营员账号',
  'organizer_admin.update': '更新平台主办方运营员账号',
  'organizer_admin.deactivate': '停用平台主办方运营员账号',
  'organizer_admin.delete': '删除平台主办方运营员账号',
  'organizer_ops.assignment.update': '更新主办方运营分配',
  'organizer_ops.follow_up.create': '新增主办方跟进记录',
  'support.account.create': '创建客服账号',
  'support.account.update': '更新客服账号',
  'support.account.deactivate': '停用客服账号',
  'support.account.delete': '删除客服账号',
  'exception_task.claim': '认领异常任务',
  'exception_task.resolve': '处理异常任务',
  'exception_task.close': '关闭异常任务',
  'reconciliation_difference.resolve': '处理对账差异',
  'reconciliation_difference.ignore': '忽略对账差异',
  'activity.deactivate.refund': '下架活动并退款',
  'tour.deactivate.refund': '下架巡演并退款',
  'ticket_type.create': '创建票档',
  'ticket_type.update': '更新票档',
}

const OPERATION_TARGET_TYPE_LABELS: Record<string, string> = {
  activity: '活动',
  tour: '巡演',
  artist: '艺人档案',
  user: '用户',
  phone: '手机号',
  support_account: '客服账号',
  rbac_role: '角色',
  rbac_role_permission: '角色权限',
  organizer_admin: '平台主办方运营员账号',
  organizer_ops_assignment: '主办方运营分配',
  organizer_ops_follow_up: '主办方跟进记录',
  exception_task: '异常任务',
  reconciliation_difference: '对账差异',
  station_config_version: '站点变更审核',
  venue_application: '场馆资料审核',
  ticket_type: '票档',
}

const ORGANIZER_OPS_FOLLOW_TYPE_LABELS: Record<string, string> = {
  note: '内部备注',
  phone: '电话沟通',
  material: '材料补充',
  audit: '审核处理',
  risk: '风险复核',
}

const ORGANIZER_OPS_RISK_LEVEL_LABELS: Record<string, string> = {
  normal: '正常',
  watch: '关注',
  high: '高风险',
}

const EXCEPTION_TASK_TYPE_LABELS: Record<string, string> = {
  PAYMENT_TIMEOUT: '支付超时',
  REFUND_UNKNOWN: '退款结果未知',
  TICKET_ISSUE: '出票异常',
  STOCK_SYNC: '库存同步异常',
  RISK_REVIEW: '风险复核',
  RECONCILE_DIFF: '对账差异',
  payment_abnormal: '支付异常',
  refund_failed: '退款失败',
  abnormal_refund: '异常退款',
  ticket_issue_failed: '出票失败',
  stock_deduct_failed: '库存扣减失败',
  duplicate_payment: '重复支付',
}

const STATION_CONFIG_CHANGE_TYPE_LABELS: Record<string, string> = {
  create: '创建站点',
  update_city: '修改城市',
  set_venue: '设置场馆',
  change_venue: '变更场馆',
  set_schedule: '设置场次时间',
  change_schedule: '调整场次时间',
  delete_station: '删除站点',
}

const STATION_CONFIG_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '待审核',
  approved: '已通过',
  applied: '已应用',
  rejected: '已驳回',
  withdrawn: '已撤回',
}

const RECONCILIATION_SUMMARY_KEY_LABELS: Record<string, string> = {
  summary: '摘要',
  bizDate: '业务日期',
  业务日期: '业务日期',
  paymentCount: '支付笔数',
  支付笔数: '支付笔数',
  paymentAmount: '支付金额',
  支付金额: '支付金额',
  refundCount: '退款笔数',
  退款笔数: '退款笔数',
  refundAmount: '退款金额',
  退款金额: '退款金额',
  netAmount: '净额',
  净额: '净额',
  paidOrderCount: '已支付订单数',
  refundAbnormalCount: '退款异常数',
  diffCount: '差异数',
  差异数: '差异数',
}

const RECONCILIATION_BATCH_STATUS_LABELS: Record<string, string> = {
  generated: '已生成',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
}

const RECONCILIATION_DETAIL_STATUS_LABELS: Record<string, string> = {
  matched: '已匹配',
  unmatched: '未匹配',
  pending: '待处理',
  different: '存在差异',
}

const RECONCILIATION_DIFFERENCE_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  resolved: '已处理',
  ignored: '已忽略',
}

const RECONCILIATION_SOURCE_LABELS: Record<string, string> = {
  local: '本地日结',
  alipay: '支付宝',
}

const RECONCILIATION_BUSINESS_TYPE_LABELS: Record<string, string> = {
  order: '订单',
  payment: '支付',
  refund: '退款',
  ticket: '票务',
  summary: '汇总',
}

const RECONCILIATION_DIFF_TYPE_LABELS: Record<string, string> = {
  amount_mismatch: '金额不一致',
  refund_amount_mismatch: '退款金额不一致',
  missing_local: '本地缺失',
  missing_channel: '渠道缺失',
  status_mismatch: '状态不一致',
}

const EXCEPTION_SEVERITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const EXCEPTION_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已处理',
  closed: '已关闭',
}

export type OperationAuditFilterOption = {
  value: string
  label: string
}

function labelFrom(map: Record<string, string>, value: string | null | undefined, fallback = '-') {
  const key = value?.trim()
  if (!key) return fallback
  return map[key] ?? key
}

function knownLabelFrom(map: Record<string, string>, value: string | null | undefined, unknownLabel: string) {
  const key = value?.trim()
  if (!key) return '-'
  return map[key] ?? unknownLabel
}

function knownLabelFromAnyCase(map: Record<string, string>, value: string | null | undefined, unknownLabel: string) {
  const key = value?.trim()
  if (!key) return '-'
  const candidates = [key, key.toLowerCase(), key.toUpperCase()]
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(map, candidate)) return map[candidate]
  }
  return unknownLabel
}

function buildFilterOptions(map: Record<string, string>): OperationAuditFilterOption[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }))
}

export function getOperationActionFilterOptions() {
  return buildFilterOptions(OPERATION_ACTION_LABELS)
}

export function getOperationTargetTypeFilterOptions() {
  return buildFilterOptions(OPERATION_TARGET_TYPE_LABELS)
}

export function getExceptionTaskTypeOptions() {
  return buildFilterOptions(EXCEPTION_TASK_TYPE_LABELS)
}

export function formatOperatorRole(role: string | null | undefined) {
  return knownLabelFrom(ROLE_LABELS, role, '未知角色')
}

export function formatOperationAction(action: string | null | undefined) {
  return knownLabelFrom(OPERATION_ACTION_LABELS, action, '未知操作')
}

export function formatOperationTargetType(targetType: string | null | undefined) {
  return knownLabelFrom(OPERATION_TARGET_TYPE_LABELS, targetType, '未知对象')
}

export function formatOperationTargetRef(
  targetType: string | null | undefined,
  targetRef: string | null | undefined,
  targetId?: number | null,
) {
  const ref = targetRef?.trim()
  const type = targetType?.trim()
  if (ref) {
    if (type === 'rbac_role' || type === 'rbac_role_permission') return `角色：${formatOperatorRole(ref)}`
    if (type === 'phone') return `手机号：${ref}`
    if (type === 'user') return `账号：${ref}`
    if (type === 'organizer_ops_assignment') {
      if (/^\d+$/.test(ref)) return `负责人编号：${ref}`
      const riskLevel = formatOrganizerOpsRiskLevel(ref)
      if (riskLevel !== '未知风险等级') return `风险等级：${riskLevel}`
      return `跟进类型：${formatOrganizerOpsFollowType(ref)}`
    }
    if (type === 'organizer_ops_follow_up') return `跟进记录：${formatOrganizerOpsFollowType(ref)}`
    if (type === 'support_account') {
      if (ref === 'phone') return '手机号'
      return /^\d+$/.test(ref) ? `客服账号编号：${ref}` : `账号：${ref}`
    }
    return ref
  }
  if (targetId == null) return '-'
  if (type === 'support_account') return `客服账号编号：${targetId}`
  if (type === 'organizer_ops_assignment') return `负责人编号：${targetId}`
  return `对象编号：${targetId}`
}

export function formatExceptionTaskType(taskType: string | null | undefined) {
  return knownLabelFrom(EXCEPTION_TASK_TYPE_LABELS, taskType, '未知异常类型')
}

export function formatStationConfigChangeType(changeType: string | null | undefined) {
  return knownLabelFrom(STATION_CONFIG_CHANGE_TYPE_LABELS, changeType, '未知变更类型')
}

export function formatStationConfigStatus(status: string | null | undefined) {
  return knownLabelFrom(STATION_CONFIG_STATUS_LABELS, status?.toLowerCase(), '未知配置状态')
}

export function isReviewableStationConfigStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === 'submitted'
}

export function formatReconciliationSummaryKey(summaryKey: string | null | undefined) {
  return knownLabelFrom(RECONCILIATION_SUMMARY_KEY_LABELS, summaryKey, '其他指标')
}

export function formatReconciliationBatchStatus(status: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_BATCH_STATUS_LABELS, status, '未知对账批次状态')
}

export function formatReconciliationDetailStatus(status: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_DETAIL_STATUS_LABELS, status, '未知对账明细状态')
}

export function formatReconciliationDifferenceStatus(status: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_DIFFERENCE_STATUS_LABELS, status, '未知对账差异状态')
}

function normalizeReconciliationDifferenceStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase()
}

export function isKnownReconciliationDifferenceStatus(status: string | null | undefined) {
  const normalized = normalizeReconciliationDifferenceStatus(status)
  return normalized === 'open' || normalized === 'resolved' || normalized === 'ignored'
}

export function isOpenReconciliationDifferenceStatus(status: string | null | undefined) {
  return normalizeReconciliationDifferenceStatus(status) === 'open'
}

export function formatReconciliationSource(source: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_SOURCE_LABELS, source, '未知来源')
}

export function formatReconciliationBusinessType(type: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_BUSINESS_TYPE_LABELS, type, '未知业务类型')
}

export function formatReconciliationDiffType(type: string | null | undefined) {
  return knownLabelFromAnyCase(RECONCILIATION_DIFF_TYPE_LABELS, type, '未知差异类型')
}

export function formatExceptionSeverity(severity: string | null | undefined) {
  return knownLabelFrom(EXCEPTION_SEVERITY_LABELS, severity, '未知等级')
}

export function formatExceptionStatus(status: string | null | undefined) {
  return knownLabelFrom(EXCEPTION_STATUS_LABELS, status, '未知异常状态')
}

function normalizeExceptionStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase()
}

export function isOpenExceptionStatus(status: string | null | undefined) {
  const normalized = normalizeExceptionStatus(status)
  return normalized === 'pending' || normalized === 'processing'
}

export function isClaimableExceptionStatus(status: string | null | undefined) {
  return normalizeExceptionStatus(status) === 'pending'
}

export function isResolvableExceptionStatus(status: string | null | undefined) {
  return normalizeExceptionStatus(status) === 'processing'
}

export function isClosableExceptionStatus(status: string | null | undefined) {
  return isOpenExceptionStatus(status)
}

export function formatOrganizerOpsFollowType(followType: string | null | undefined) {
  return labelFrom(ORGANIZER_OPS_FOLLOW_TYPE_LABELS, followType?.toLowerCase(), '其他')
}

export function formatOrganizerOpsRiskLevel(riskLevel: string | null | undefined) {
  return knownLabelFrom(ORGANIZER_OPS_RISK_LEVEL_LABELS, riskLevel?.toLowerCase(), '未知风险等级')
}

export function formatOrganizerOpsAccountLabel(account: { id: number; nickname?: string | null; phone?: string | null }) {
  const rawName = account.nickname?.trim() || account.phone?.trim()
  if (!rawName) return `运营员编号：${account.id}`
  const normalized = rawName.replace(/主办方管理员/g, '平台主办方运营员')
  return `${normalized}（编号：${account.id}）`
}
