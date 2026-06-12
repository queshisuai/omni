export interface RbacPermissionDiffItem {
  code: string
  name: string
}

export interface RbacPermissionDiff {
  added: RbacPermissionDiffItem[]
  removed: RbacPermissionDiffItem[]
  hasChanges: boolean
  hasSensitiveChanges: boolean
}

type PermissionNameSource =
  | Map<string, string>
  | Record<string, string>
  | Array<{ code: string; name?: string | null }>

const SENSITIVE_PERMISSION_CODES = new Set(['rbac.manage'])

function uniquePermissionCodes(codes: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const code of codes) {
    const normalized = code.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

function resolvePermissionName(code: string, source: PermissionNameSource) {
  if (source instanceof Map) return source.get(code) || code
  if (Array.isArray(source)) return source.find(item => item.code === code)?.name || code
  return source[code] || code
}

function toDiffItems(codes: string[], source: PermissionNameSource) {
  return codes.map(code => ({ code, name: resolvePermissionName(code, source) }))
}

export function buildRbacPermissionDiff(
  before: string[],
  after: string[],
  permissionNames: PermissionNameSource,
  options: { roleCode?: string | null } = {},
): RbacPermissionDiff {
  const beforeCodes = uniquePermissionCodes(before)
  const afterCodes = uniquePermissionCodes(after)
  const beforeSet = new Set(beforeCodes)
  const afterSet = new Set(afterCodes)
  const added = toDiffItems(afterCodes.filter(code => !beforeSet.has(code)), permissionNames)
  const removed = toDiffItems(beforeCodes.filter(code => !afterSet.has(code)), permissionNames)
  const hasSensitiveChanges =
    options.roleCode === 'platform_super_admin' ||
    [...added, ...removed].some(item => SENSITIVE_PERMISSION_CODES.has(item.code))

  return {
    added,
    removed,
    hasChanges: added.length > 0 || removed.length > 0,
    hasSensitiveChanges,
  }
}

export function formatRbacPermissionDiffList(items: RbacPermissionDiffItem[], limit = 8) {
  if (items.length === 0) return '无'
  const visibleItems = items.slice(0, limit).map(item => `${item.name}（${item.code}）`)
  if (items.length > visibleItems.length) {
    visibleItems.push(`另有 ${items.length - visibleItems.length} 项`)
  }
  return visibleItems.join('\n')
}
