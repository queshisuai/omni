import type { RbacPermissionVO, RbacRoleVO } from '@/types/api'

export const ROLE_ORDER = [
  'platform_super_admin',
  'organizer',
  'organizer_admin',
  'support_manager',
  'support_agent',
] as const

export const ROOT_LOCK_TOOLTIP = '核心自保权限：平台超管的角色权限管理不可取消，以防系统失去授权能力而死锁。'

export interface RbacPermissionDomain {
  key: 'ticket' | 'fulfillment' | 'operations' | 'governance'
  title: string
  summary: string
  permissionCodes: string[]
}

export const RBAC_PERMISSION_DOMAINS: RbacPermissionDomain[] = [
  {
    key: 'ticket',
    title: '演出与票务管理',
    summary: '活动、场次、巡演、场馆、艺人和评价问答',
    permissionCodes: [
      'activity.manage',
      'session.manage',
      'tour.manage',
      'venue.manage',
      'venue.review',
      'station.review',
      'artist.manage',
      'activity.review.manage',
    ],
  },
  {
    key: 'fulfillment',
    title: '订单与履约中心',
    summary: '订单、退款、入场核验、设备和异常补偿',
    permissionCodes: [
      'order.view',
      'refund.review',
      'checkin.view',
      'checkin.sync',
      'checkin.device.manage',
      'compensation.execute',
    ],
  },
  {
    key: 'operations',
    title: '运营、客服与审核',
    summary: '主办方运营、客服工作台、质检和风险审核',
    permissionCodes: [
      'organizer.review',
      'organizer.follow.manage',
      'organizer.account.manage',
      'organizer.assign.manage',
      'cs.manage',
      'cs.review',
      'support.conversation.view',
      'support.account.manage',
      'risk.view',
      'risk.review',
    ],
  },
  {
    key: 'governance',
    title: '系统治理与财务安全',
    summary: '角色权限、审计和日结对账',
    permissionCodes: [
      'rbac.manage',
      'audit.view',
      'reconcile.view',
    ],
  },
]

const ROLE_ORDER_RANK = new Map<string, number>(ROLE_ORDER.map((code, index) => [code, index]))
const PERMISSION_ORDER_RANK = new Map<string, number>(
  RBAC_PERMISSION_DOMAINS.flatMap(domain => domain.permissionCodes).map((code, index) => [code, index]),
)

export function orderRbacRoles<T extends Pick<RbacRoleVO, 'code'>>(roles: T[]): T[] {
  return [...roles].sort((left, right) => {
    const leftRank = ROLE_ORDER_RANK.get(left.code) ?? Number.MAX_SAFE_INTEGER
    const rightRank = ROLE_ORDER_RANK.get(right.code) ?? Number.MAX_SAFE_INTEGER
    if (leftRank !== rightRank) return leftRank - rightRank
    return left.code.localeCompare(right.code)
  })
}

export function groupRbacPermissionsByDomain(permissions: RbacPermissionVO[]) {
  const byCode = new Map(permissions.map(permission => [permission.code, permission]))
  return RBAC_PERMISSION_DOMAINS.map(domain => ({
    ...domain,
    items: domain.permissionCodes
      .map(code => byCode.get(code))
      .filter((permission): permission is RbacPermissionVO => Boolean(permission)),
  }))
}

export function orderRbacPermissionCodes(codes: string[]) {
  const seen = new Set<string>()
  return codes
    .map(code => code.trim())
    .filter(code => {
      if (!code || seen.has(code)) return false
      seen.add(code)
      return true
    })
    .sort((left, right) => {
      const leftRank = PERMISSION_ORDER_RANK.get(left) ?? Number.MAX_SAFE_INTEGER
      const rightRank = PERMISSION_ORDER_RANK.get(right) ?? Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.localeCompare(right)
    })
}

export function isRootLockedPermission(roleCode: string | null | undefined, permissionCode: string) {
  return roleCode === 'platform_super_admin' && permissionCode === 'rbac.manage'
}
