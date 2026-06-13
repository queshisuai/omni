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
    description: '客服账号、会话查询和操作审计。',
    roleCodes: ['support_manager'],
    permissionCodes: ['support.account.manage', 'support.conversation.view', 'audit.view'],
  },
  {
    code: 'support_agent_standard',
    name: '普通客服标准模板',
    description: '仅保留客服会话查询。',
    roleCodes: ['support_agent'],
    permissionCodes: ['support.conversation.view'],
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
    description: '主办方运营、活动管理、订单退款、核验、评价问答和操作审计。',
    roleCodes: ['organizer_admin'],
    permissionCodes: [
      'activity.manage',
      'tour.manage',
      'session.manage',
      'artist.manage',
      'order.view',
      'refund.review',
      'venue.manage',
      'organizer.review',
      'organizer.account.manage',
      'venue.review',
      'audit.view',
      'checkin.view',
      'checkin.device.manage',
      'organizer.follow.manage',
      'organizer.assign.manage',
      'activity.review.manage',
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
  if (!normalizedRoleCode || normalizedRoleCode === 'platform_super_admin') return []

  const availablePermissionSet = new Set(uniquePermissionCodes(availablePermissionCodes))
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
