export function canLoadPlatformOpsSummary(role: string | null | undefined): boolean {
  if (role === 'admin' || role === 'platform_super_admin') return true
  return false
}
