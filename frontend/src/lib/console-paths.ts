import type { UserRole } from '@/types/api'

export interface ConsoleQuickAction {
  label: string
  href: string
}

const PERMISSION_QUICK_ACTIONS: Array<{ permission: string; label: string; href: string }> = [
  { permission: 'activity.manage', label: '活动管理', href: '/console/activities' },
  { permission: 'tour.manage', label: '巡演草稿', href: '/console/tours' },
  { permission: 'session.manage', label: '场次管理', href: '/console/sessions' },
  { permission: 'artist.manage', label: '艺人管理', href: '/console/artists' },
  { permission: 'order.view', label: '订单查看', href: '/console/orders' },
  { permission: 'refund.review', label: '退款审核', href: '/console/refunds' },
  { permission: 'venue.manage', label: '场馆记录', href: '/console/venue' },
  { permission: 'organizer.review', label: '主办方管理', href: '/console/organizer-applications' },
  { permission: 'organizer.account.manage', label: '主办方管理员', href: '/console/organizer-admins' },
  { permission: 'venue.review', label: '场馆资料审核', href: '/console/venue/applications' },
  { permission: 'station.review', label: '站点变更审核', href: '/console/station-config-reviews' },
  { permission: 'risk.review', label: '恢复售票审核', href: '/console/risk-resolutions' },
  { permission: 'risk.view', label: '风险案例管理', href: '/console/risk-cases' },
  { permission: 'support.account.manage', label: '客服账号管理', href: '/console/support-accounts' },
  { permission: 'support.conversation.view', label: '客服会话查询', href: '/console/support-conversations' },
  { permission: 'audit.view', label: '操作审计', href: '/console/audit-logs' },
  { permission: 'compensation.execute', label: '异常任务', href: '/console/exception-tasks' },
  { permission: 'reconcile.view', label: '日结对账', href: '/console/reconciliation' },
  { permission: 'rbac.manage', label: '角色权限', href: '/console/roles' },
]

const ORGANIZER_BLOCKED_PREFIXES = [
  '/console/artists/pending',
  '/console/risk-cases',
  '/console/risk-resolutions',
  '/console/venue/applications',
  '/console/station-config-reviews',
  '/console/organizer-applications',
  '/console/support-accounts',
  '/console/support-conversations',
]

const ORGANIZER_ALLOWED_PREFIXES = [
  '/console/activities',
  '/console/sessions',
  '/console/artists',
  '/console/risk-events',
  '/console/refunds',
  '/console/venue',
  '/console/orders',
  '/console/profile',
  '/console/tours',
  '/console/stations',
]

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isConsolePathAllowedForRole(role: UserRole | string | null | undefined, pathname: string) {
  if (!pathname.startsWith('/console')) return false
  if (role === 'admin' || role === 'platform_super_admin') return pathname === '/console' || pathname === '/console/profile'
  if (role !== 'organizer') return false
  if (pathname === '/console') return true
  if (ORGANIZER_BLOCKED_PREFIXES.some(prefix => matchesPath(pathname, prefix))) return false
  if (pathname.startsWith('/console/venue/') && !matchesPath(pathname, '/console/venue/apply')) return false
  return ORGANIZER_ALLOWED_PREFIXES.some(prefix => matchesPath(pathname, prefix))
}

export function getConsoleQuickActions(role: UserRole | string | null | undefined, permissionCodes: string[] = []): ConsoleQuickAction[] {
  if (role === 'admin' || role === 'platform_super_admin') {
    return PERMISSION_QUICK_ACTIONS
      .filter(action => permissionCodes.includes(action.permission))
      .map(({ label, href }) => ({ label, href }))
  }

  if (role === 'organizer') {
    return [
      { label: '新建活动草稿', href: '/console/activities/new' },
      { label: '我的活动', href: '/console/activities' },
      { label: '巡演草稿', href: '/console/tours' },
      { label: '场馆记录', href: '/console/venue' },
      { label: '退款处理', href: '/console/refunds' },
      { label: '查看订单', href: '/console/orders' },
    ]
  }

  if (role === 'organizer_admin') {
    return [
      ...PERMISSION_QUICK_ACTIONS
        .filter(action => permissionCodes.includes(action.permission))
        .map(({ label, href }) => ({ label, href })),
      { label: '个人中心', href: '/console/profile' },
    ]
  }

  if (role === 'support') {
    const actions: ConsoleQuickAction[] = []
    if (permissionCodes.includes('support.account.manage')) {
      actions.push({ label: '客服账号管理', href: '/console/support-accounts' })
    }
    if (permissionCodes.includes('support.conversation.view')) {
      actions.push({ label: '客服会话查询', href: '/console/support-conversations' })
    }
    if (permissionCodes.includes('audit.view')) {
      actions.push({ label: '操作审计', href: '/console/audit-logs' })
    }
    actions.push({ label: '个人中心', href: '/console/profile' })
    return actions
  }

  return []
}
