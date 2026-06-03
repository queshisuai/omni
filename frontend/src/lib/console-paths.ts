import type { UserRole } from '@/types/api'

export interface ConsoleQuickAction {
  label: string
  href: string
}

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
  if (role === 'admin' || role === 'platform_super_admin') return true
  if (role !== 'organizer') return false
  if (pathname === '/console') return true
  if (ORGANIZER_BLOCKED_PREFIXES.some(prefix => matchesPath(pathname, prefix))) return false
  if (pathname.startsWith('/console/venue/') && !matchesPath(pathname, '/console/venue/apply')) return false
  return ORGANIZER_ALLOWED_PREFIXES.some(prefix => matchesPath(pathname, prefix))
}

export function getConsoleQuickActions(role: UserRole | string | null | undefined): ConsoleQuickAction[] {
  if (role === 'admin' || role === 'platform_super_admin') {
    return [
      { label: '新建活动', href: '/console/activities/new' },
      { label: '管理活动', href: '/console/activities' },
      { label: '巡演草稿', href: '/console/tours' },
      { label: '主办方管理', href: '/console/organizer-applications' },
      { label: '角色权限', href: '/console/roles' },
      { label: '主办方管理员', href: '/console/organizer-admins' },
      { label: '客服账号管理', href: '/console/support-accounts' },
      { label: '客服会话记录', href: '/console/support-conversations' },
      { label: '操作审计', href: '/console/audit-logs' },
      { label: '异常任务', href: '/console/exception-tasks' },
      { label: '日结对账', href: '/console/reconciliation' },
      { label: '查看订单', href: '/console/orders' },
    ]
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

  return []
}
