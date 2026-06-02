const PATH_PERMISSION_MAP: Record<string, string[]> = {
  '/console/support-accounts': ['support.account.manage'],
  '/console/support-conversations': ['support.conversation.view'],
  '/console/station-config-reviews': ['station.review'],
  '/console/venue/applications': ['venue.review'],
  '/console/risk-resolutions': ['risk.review'],
  '/console/risk-cases': ['risk.view'],
  '/console/organizer-applications': ['organizer.review'],
  '/console/activities': ['activity.manage'],
  '/console/tours': ['tour.manage'],
  '/console/sessions': ['session.manage'],
  '/console/refunds': ['refund.review'],
  '/console/venue': ['venue.manage'],
  '/console/artists': ['artist.manage'],
  '/console/orders': ['order.view'],
  '/console/audits': ['audit.view'],
  '/console/exception-tasks': ['compensation.execute'],
  '/console/reconciliation': ['reconcile.view'],
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
