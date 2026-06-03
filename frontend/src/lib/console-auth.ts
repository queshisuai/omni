const PATH_PERMISSION_MAP: Record<string, string[]> = {
  '/console/support-accounts': ['support.account.manage'],
  '/console/support-conversations': ['support.conversation.view'],
  '/console/station-config-reviews': ['station.review'],
  '/console/venue/applications': ['venue.review'],
  '/console/risk-resolutions': ['risk.review'],
  '/console/risk-cases': ['risk.view'],
  '/console/organizer-applications': ['organizer.review'],
  '/console/organizer-admins': ['organizer.account.manage'],
  '/console/roles': ['rbac.manage'],
  '/console/activities': ['activity.manage'],
  '/console/tours': ['tour.manage'],
  '/console/sessions': ['session.manage'],
  '/console/refunds': ['refund.review'],
  '/console/venue': ['venue.manage'],
  '/console/artists': ['artist.manage'],
  '/console/orders': ['order.view'],
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

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'platform_super_admin'
}

function getPathPermission(pathname: string): string[] {
  if (pathname === '/console' || pathname === '/console/profile') return ['*']
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
  if (role === 'organizer_admin') return '/console/organizer-admins'
  if (role === 'support') {
    if (permissionCodes.includes('support.account.manage')) return '/console/support-accounts'
    if (permissionCodes.includes('audit.view')) return '/console/audit-logs'
    if (permissionCodes.includes('support.conversation.view')) return '/console/support-conversations'
  }
  return '/console'
}

export function getConsoleRoleLabel(role: string | null | undefined, permissionCodes: string[] = []): string {
  if (role === 'platform_super_admin') return '平台超管'
  if (role === 'admin') return '平台管理员'
  if (role === 'organizer') return '活动主办方'
  if (role === 'organizer_admin') return '主办方管理员'
  if (role === 'support') {
    return SUPPORT_MANAGER_PERMISSIONS.some(permission => permissionCodes.includes(permission)) ? '客服主管' : '普通客服'
  }
  return '普通用户'
}

export function getConsoleBrandLabel(role: string | null | undefined, permissionCodes: string[] = []): string {
  if (isPlatformAdminRole(role)) return '平台后台'
  if (role === 'organizer') return '主办方后台'
  if (role === 'organizer_admin') return '主办方管理后台'
  if (role === 'support') {
    return SUPPORT_MANAGER_PERMISSIONS.some(permission => permissionCodes.includes(permission)) ? '客服管理后台' : '客服后台'
  }
  return '后台'
}
