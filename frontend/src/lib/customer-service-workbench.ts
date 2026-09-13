import type { CsOrgTreeVO, CsSessionQueryParams, CsSessionVO, CsSkillGroupVO } from '../types/api.ts'

export interface CustomerServiceUserGroup {
  userId: number
  userName: string
  userPhone?: string | null
  latestSession: CsSessionVO
  historyList: CsSessionVO[]
}

export type CustomerServiceOrgSelection =
  | { type: 'all' }
  | { type: 'pool' }
  | { type: 'ai-resolved' }
  | { type: 'ai-human' }
  | { type: 'group'; groupId: number }
  | { type: 'agent'; groupId: number; agentId: number }

export function buildCustomerServiceSelectionQuery(selection: CustomerServiceOrgSelection): Pick<CsSessionQueryParams, 'groupId' | 'agentId' | 'unassignedOnly' | 'sourceType'> {
  if (selection.type === 'pool') return { unassignedOnly: true }
  if (selection.type === 'ai-resolved' || selection.type === 'ai-human') return { sourceType: 'AI' }
  if (selection.type === 'group') return { groupId: selection.groupId }
  if (selection.type === 'agent') return { groupId: selection.groupId, agentId: selection.agentId }
  return {}
}

export interface CustomerServiceSlaMeta {
  label: string
  tone: 'normal' | 'warning' | 'danger'
}

function getSessionSortTime(session: Pick<CsSessionVO, 'updateTime' | 'createTime'>) {
  const value = session.updateTime || session.createTime
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

function compareSessionsLatestFirst(left: CsSessionVO, right: CsSessionVO) {
  return getSessionSortTime(right) - getSessionSortTime(left) || right.id - left.id
}

export function groupCustomerServiceSessionsByUser(sessions: CsSessionVO[]): CustomerServiceUserGroup[] {
  const grouped = new Map<number, CustomerServiceUserGroup>()

  for (const session of sessions) {
    const current = grouped.get(session.userId)
    if (current) {
      current.historyList.push(session)
      continue
    }
    grouped.set(session.userId, {
      userId: session.userId,
      userName: session.userNickname || session.userPhoneMask || `用户编号：${session.userId}`,
      userPhone: session.userPhoneMask,
      latestSession: session,
      historyList: [session],
    })
  }

  return Array.from(grouped.values())
    .map(group => {
      const historyList = [...group.historyList].sort(compareSessionsLatestFirst)
      return { ...group, latestSession: historyList[0], historyList }
    })
    .sort((left, right) => compareSessionsLatestFirst(left.latestSession, right.latestSession))
}

export function buildCustomerServiceSessionQuery(params: CsSessionQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.groupId) searchParams.set('groupId', String(params.groupId))
  if (params.agentId) searchParams.set('agentId', String(params.agentId))
  if (params.unassignedOnly) searchParams.set('unassignedOnly', 'true')
  if (params.sourceType) searchParams.set('sourceType', params.sourceType)
  if (params.status) searchParams.set('status', params.status)
  if (params.slaTimeoutOnly) searchParams.set('slaTimeoutOnly', 'true')
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim())
  searchParams.set('page', String(params.page || 1))
  searchParams.set('size', String(params.size || 30))
  if (params.sort) searchParams.set('sort', params.sort)
  return searchParams.toString()
}

export function filterCustomerServiceOrgTree(tree: CsOrgTreeVO, keyword = ''): CsOrgTreeVO {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return tree

  const matches = (value?: string | number | null) => String(value ?? '').toLocaleLowerCase().includes(normalizedKeyword)
  const groups = tree.groups
    .map(group => {
      const agents = group.agents.filter(agent => matches(agent.agentName) || matches(agent.userId))
      const groupMatched = matches(group.groupName) || matches(group.groupCode) || matches(group.leaderName) || matches(group.leaderUserId)
      return groupMatched ? group : { ...group, agents }
    })
    .filter(group => matches(group.groupName) || matches(group.groupCode) || matches(group.leaderName) || group.agents.length > 0)

  return { ...tree, groups }
}

export function getCustomerServiceSlaMeta(session: Pick<CsSessionVO, 'slaOverdue' | 'slaTimeoutFlag'>): CustomerServiceSlaMeta {
  if (session.slaOverdue && session.slaTimeoutFlag) return { label: '超时未回复', tone: 'danger' }
  if (session.slaOverdue) return { label: '回复预警', tone: 'warning' }
  return { label: '服务正常', tone: 'normal' }
}

export function getCustomerServiceAssignmentLabel(session: Pick<CsSessionVO, 'sourceType' | 'assignedAgentName' | 'escalatedToAdmin'>) {
  if (session.escalatedToAdmin) return '已转工单'
  if (session.sourceType === 'AI' && !session.assignedAgentName) return 'AI 接待'
  if (session.assignedAgentName) return `坐席·${session.assignedAgentName}`
  return '待认领'
}

export function selectCustomerServiceSessions(sessions: CsSessionVO[], selection: CustomerServiceOrgSelection) {
  if (selection.type === 'all') return sessions
  if (selection.type === 'pool') return sessions.filter(session => !session.assignedAgentId && session.status === 'ACTIVE')
  if (selection.type === 'ai-resolved') return sessions.filter(session => session.sourceType === 'AI' && session.status === 'CLOSED')
  if (selection.type === 'ai-human') return sessions.filter(session => session.sourceType === 'AI' && session.status !== 'CLOSED')
  if (selection.type === 'group') return sessions.filter(session => session.skillGroupId === selection.groupId)
  return sessions.filter(session => session.skillGroupId === selection.groupId && session.assignedAgentId === selection.agentId)
}

export function getCustomerServiceGroup(tree: CsOrgTreeVO, groupId: number): CsSkillGroupVO | null {
  return tree.groups.find(group => group.id === groupId) || null
}
