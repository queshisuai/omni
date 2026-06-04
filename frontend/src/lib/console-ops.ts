const PLATFORM_OPS_PERMISSIONS = ['compensation.execute', 'reconcile.view', 'audit.view']

export function canLoadPlatformOpsSummary(_role: string | null | undefined, permissionCodes: string[] = []): boolean {
  return PLATFORM_OPS_PERMISSIONS.every(permission => permissionCodes.includes(permission))
}
