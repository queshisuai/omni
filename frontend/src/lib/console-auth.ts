const PATH_PERMISSION_MAP: Record<string, string[]> = {
  '/console/support-accounts': ['support.account.manage'],
  '/console/support-conversations': ['support.conversation.view'],
  '/console/station-config-reviews': ['station.review'],
  '/console/venue/applications': ['venue.review'],
  '/console/risk-resolutions': ['risk.review'],
  '/console/risk-cases': ['risk.view'],
  '/console/activity-engagement': ['activity.review.manage'],
  '/console/organizer-ops': ['organizer.review', 'organizer.account.manage', 'organizer.follow.manage', 'organizer.assign.manage'],
  '/console/organizer-applications': ['organizer.review'],
  '/console/organizer-admins': ['organizer.account.manage'],
  '/console/roles': ['rbac.manage'],
  '/console/activities/new': ['activity.manage', 'tour.manage'],
  '/console/activities': ['activity.manage'],
  '/console/tours': ['activity.manage', 'tour.manage'],
  '/console/sessions': ['session.manage'],
  '/console/refunds': ['refund.review'],
  '/console/venue': ['venue.manage'],
  '/console/artists': ['artist.manage'],
  '/console/orders': ['order.view'],
  '/console/check-in': ['checkin.view'],
  '/console/audit-logs': ['audit.view'],
  '/console/exception-tasks': ['compensation.execute'],
  '/console/reconciliation': ['reconcile.view'],
}

const SUPPORT_CONSOLE_PERMISSIONS = [
  'support.account.manage',
  'support.conversation.view',
  'audit.view',
]

const SUPPORT_MANAGER_PERMISSIONS = [
  'support.account.manage',
  'audit.view',
]

const ORGANIZER_BUSINESS_PERMISSIONS = [
  'activity.manage',
  'tour.manage',
  'session.manage',
  'artist.manage',
  'order.view',
  'checkin.view',
  'refund.review',
  'venue.manage',
  'risk.view',
]

const DEFAULT_PATH_BY_PERMISSION: Array<[string, string]> = [
  ['activity.manage', '/console/activities'],
  ['tour.manage', '/console/tours'],
  ['session.manage', '/console/sessions'],
  ['artist.manage', '/console/artists'],
  ['order.view', '/console/orders'],
  ['activity.review.manage', '/console/activity-engagement'],
  ['checkin.view', '/console/check-in'],
  ['refund.review', '/console/refunds'],
  ['venue.manage', '/console/venue'],
  ['organizer.review', '/console/organizer-applications'],
  ['organizer.follow.manage', '/console/organizer-ops'],
  ['organizer.assign.manage', '/console/organizer-ops'],
  ['organizer.account.manage', '/console/organizer-admins'],
  ['venue.review', '/console/venue/applications'],
  ['station.review', '/console/station-config-reviews'],
  ['risk.review', '/console/risk-resolutions'],
  ['risk.view', '/console/risk-cases'],
  ['support.account.manage', '/console/support-accounts'],
  ['support.conversation.view', '/console/support-conversations'],
  ['audit.view', '/console/audit-logs'],
  ['compensation.execute', '/console/exception-tasks'],
  ['reconcile.view', '/console/reconciliation'],
  ['rbac.manage', '/console/roles'],
]

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'platform_super_admin'
}

function getPathPermission(pathname: string): string[] {
  if (pathname === '/console' || pathname === '/console/profile') return ['*']
  if (pathname.startsWith('/console/tours/')) return ['tour.manage']
  const exact = PATH_PERMISSION_MAP[pathname]
  if (exact) return exact
  for (const [prefix, perms] of Object.entries(PATH_PERMISSION_MAP)) {
    if (pathname.startsWith(`${prefix}/`)) return perms
  }
  return []
}

export function canAccessConsolePath(pathname: string, permissionCodes: string[]): boolean {
  const required = getPathPermission(pathname)
  if (required.length === 0) return false
  if (required[0] === '*') return true
  return required.some(p => permissionCodes.includes(p))
}

export function canUseConsoleAction(action: string, permissionCodes: string[]): boolean {
  return permissionCodes.includes(action)
}

export function hasConsolePermission(role: string | null | undefined, permissionCodes: string[] = [], permissionCode: string): boolean {
  if (role === 'organizer' && ORGANIZER_BUSINESS_PERMISSIONS.includes(permissionCode)) return true
  return permissionCodes.includes(permissionCode)
}

export function canEnterConsole(role: string | null | undefined, permissionCodes: string[] = []): boolean {
  if (isPlatformAdminRole(role) || role === 'organizer' || role === 'organizer_admin') return true
  if (role !== 'support') return false
  return SUPPORT_CONSOLE_PERMISSIONS.some(permission => permissionCodes.includes(permission))
}

export function shouldDefaultToConsoleAfterLogin(role: string | null | undefined, permissionCodes: string[] = []): boolean {
  if (isPlatformAdminRole(role) || role === 'organizer' || role === 'organizer_admin') return true
  if (role !== 'support') return false
  return SUPPORT_MANAGER_PERMISSIONS.some(permission => permissionCodes.includes(permission))
}

export function getDefaultConsolePath(role: string | null | undefined, permissionCodes: string[] = []): string {
  if (role === 'organizer_admin') {
    if (
      permissionCodes.includes('organizer.review') ||
      permissionCodes.includes('organizer.account.manage') ||
      permissionCodes.includes('organizer.follow.manage') ||
      permissionCodes.includes('organizer.assign.manage')
    ) {
      return '/console/organizer-ops'
    }
    return getFirstPermissionPath(permissionCodes) || '/console'
  }
  if (role === 'support') {
    if (permissionCodes.includes('support.account.manage')) return '/console/support-accounts'
    if (permissionCodes.includes('audit.view')) return '/console/audit-logs'
    if (permissionCodes.includes('support.conversation.view')) return '/console/support-conversations'
  }
  return '/console'
}

function getFirstPermissionPath(permissionCodes: string[]): string | null {
  for (const [permission, path] of DEFAULT_PATH_BY_PERMISSION) {
    if (permissionCodes.includes(permission)) return path
  }
  return null
}

export function getConsoleRoleLabel(role: string | null | undefined, permissionCodes: string[] = []): string {
  if (role === 'platform_super_admin') return '平台超管'
  if (role === 'admin') return '平台管理员'
  if (role === 'organizer') return '活动主办方'
  if (role === 'organizer_admin') return '平台主办方运营员'
  if (role === 'support') {
    return SUPPORT_MANAGER_PERMISSIONS.some(permission => permissionCodes.includes(permission)) ? '客服主管' : '普通客服'
  }
  return '普通用户'
}

export function getConsoleBrandLabel(role: string | null | undefined, permissionCodes: string[] = []): string {
  if (isPlatformAdminRole(role)) return '平台后台'
  if (role === 'organizer') return '主办方后台'
  if (role === 'organizer_admin') return '平台主办方运营后台'
  if (role === 'support') {
    return SUPPORT_MANAGER_PERMISSIONS.some(permission => permissionCodes.includes(permission)) ? '客服管理后台' : '客服后台'
  }
  return '后台'
}
