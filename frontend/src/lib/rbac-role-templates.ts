import { orderRbacPermissionCodes } from './rbac-permission-groups.ts'

export interface RbacRoleTemplate {
  code: string
  name: string
  description: string
  roleCodes: string[]
  permissionCodes: string[]
  missingPermissionCodes: string[]
}

interface RbacRoleTemplateDefinition {
  code: string
  name: string
  description: string
  roleCodes: string[]
  permissionCodes: string[]
}

const RBAC_ROLE_TEMPLATE_DEFINITIONS: RbacRoleTemplateDefinition[] = [
  {
    code: 'support_manager_standard',
    name: '客服主管标准模板',
    description: '客服管理、质检、订单退款协查、风险查看和审计。',
    roleCodes: ['support_manager'],
    permissionCodes: [
      'support.account.manage',
      'support.conversation.view',
      'cs.manage',
      'cs.review',
      'order.view',
      'refund.review',
      'risk.view',
      'audit.view',
    ],
  },
  {
    code: 'support_agent_standard',
    name: '普通客服标准模板',
    description: '客服会话、订单、退款和核验协查。',
    roleCodes: ['support_agent'],
    permissionCodes: ['support.conversation.view', 'order.view', 'refund.review', 'checkin.view'],
  },
  {
    code: 'organizer_standard',
    name: '主办方标准模板',
    description: '活动、巡演、场次、订单、退款、场馆、风险和核验查看。',
    roleCodes: ['organizer'],
    permissionCodes: [
      'activity.manage',
      'tour.manage',
      'session.manage',
      'artist.manage',
      'order.view',
      'refund.review',
      'venue.manage',
      'risk.view',
      'checkin.view',
    ],
  },
  {
    code: 'organizer_admin_standard',
    name: '平台主办方运营员标准模板',
    description: '主办方入驻、跟进、账号、分配、场馆和站点审核。',
    roleCodes: ['organizer_admin'],
    permissionCodes: [
      'organizer.review',
      'organizer.follow.manage',
      'organizer.account.manage',
      'organizer.assign.manage',
      'venue.review',
      'station.review',
    ],
  },
]

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

export function getRbacRoleTemplatesForRole(
  roleCode: string | null | undefined,
  availablePermissionCodes: string[],
): RbacRoleTemplate[] {
  const normalizedRoleCode = roleCode?.trim()
  if (!normalizedRoleCode) return []

  const availablePermissionSet = new Set(uniquePermissionCodes(availablePermissionCodes))
  if (normalizedRoleCode === 'platform_super_admin') {
    return [{
      code: 'platform_super_admin_full',
      name: '平台超管全权限模板',
      description: '默认包含全部已启用后台权限，仅角色权限管理受系统自保锁定。',
      roleCodes: ['platform_super_admin'],
      permissionCodes: orderRbacPermissionCodes([...availablePermissionSet]),
      missingPermissionCodes: [],
    }]
  }

  return RBAC_ROLE_TEMPLATE_DEFINITIONS
    .filter(template => template.roleCodes.includes(normalizedRoleCode))
    .map(template => {
      const definedPermissionCodes = uniquePermissionCodes(template.permissionCodes)
      return {
        ...template,
        roleCodes: [...template.roleCodes],
        permissionCodes: definedPermissionCodes.filter(code => availablePermissionSet.has(code)),
        missingPermissionCodes: definedPermissionCodes.filter(code => !availablePermissionSet.has(code)),
      }
    })
    .filter(template => template.permissionCodes.length > 0)
}
