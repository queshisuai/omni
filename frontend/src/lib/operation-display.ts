const ROLE_LABELS: Record<string, string> = {
  platform_super_admin: '平台超管',
  admin: '平台管理员',
  organizer: '活动主办方',
  organizer_admin: '主办方管理员',
  support: '客服账号',
  support_manager: '客服主管',
  support_agent: '普通客服',
  user: '普通用户',
  unknown: '未知角色',
}

const OPERATION_ACTION_LABELS: Record<string, string> = {
  'rbac.role_permission.update': '更新角色权限',
  'organizer_admin.create': '创建主办方管理员账号',
  'organizer_admin.update': '更新主办方管理员账号',
  'organizer_admin.deactivate': '停用主办方管理员账号',
  'organizer_admin.delete': '删除主办方管理员账号',
  'support.account.create': '创建客服账号',
  'support.account.update': '更新客服账号',
  'support.account.deactivate': '停用客服账号',
  'support.account.delete': '删除客服账号',
}

const OPERATION_TARGET_TYPE_LABELS: Record<string, string> = {
  user: '用户',
  phone: '手机号',
  support_account: '客服账号',
  rbac_role: '角色',
  rbac_role_permission: '角色权限',
  organizer_admin: '主办方管理员账号',
}

const EXCEPTION_TASK_TYPE_LABELS: Record<string, string> = {
  payment_abnormal: '支付异常',
  refund_failed: '退款失败',
  abnormal_refund: '异常退款',
  ticket_issue_failed: '出票失败',
  stock_deduct_failed: '库存扣减失败',
  duplicate_payment: '重复支付',
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
}

function labelFrom(map: Record<string, string>, value: string | null | undefined, fallback = '-') {
  const key = value?.trim()
  if (!key) return fallback
  return map[key] ?? key
}

export function formatOperatorRole(role: string | null | undefined) {
  return labelFrom(ROLE_LABELS, role)
}

export function formatOperationAction(action: string | null | undefined) {
  return labelFrom(OPERATION_ACTION_LABELS, action)
}

export function formatOperationTargetType(targetType: string | null | undefined) {
  return labelFrom(OPERATION_TARGET_TYPE_LABELS, targetType)
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
    if (type === 'support_account') {
      if (ref === 'phone') return '手机号'
      return /^\d+$/.test(ref) ? `ID：${ref}` : `账号：${ref}`
    }
    return ref
  }
  return targetId == null ? '-' : `ID：${targetId}`
}

export function formatExceptionTaskType(taskType: string | null | undefined) {
  return labelFrom(EXCEPTION_TASK_TYPE_LABELS, taskType)
}

export function formatExceptionSeverity(severity: string | null | undefined) {
  return labelFrom(EXCEPTION_SEVERITY_LABELS, severity)
}

export function formatExceptionStatus(status: string | null | undefined) {
  return labelFrom(EXCEPTION_STATUS_LABELS, status)
}
