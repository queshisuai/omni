import type { SupportConversationVO, SupportMessageVO, UserRole } from '@/types/api'

export type SupportConversationStatus = 'OPEN' | 'WAITING_AGENT' | 'ASSIGNED' | 'CLOSED' | string
export type SupportConversationFilter = 'active' | 'closed' | 'all'

export function getLoginRedirectForRole(role: UserRole | string | null | undefined) {
  if (role === 'support') return '/support'
  if (role === 'admin' || role === 'organizer') return '/console'
  return '/'
}

export function formatSupportConversationStatus(status: SupportConversationStatus) {
  if (status === 'OPEN') return 'AI 服务中'
  if (status === 'WAITING_AGENT') return '人工介入请等待'
  if (status === 'ASSIGNED') return '人工处理中'
  if (status === 'CLOSE_REQUESTED') return '等待用户确认结束'
  if (status === 'CLOSED') return '已结束'
  return '处理中'
}

export function buildSupportSubject(message: string | null | undefined) {
  const trimmed = message?.trim()
  if (!trimmed) return '在线客服咨询'
  return trimmed.length > 40 ? trimmed.slice(0, 40) : trimmed
}

export function formatSupportSender(senderType: string | null | undefined) {
  if (senderType === 'AI') return 'AI 客服'
  if (senderType === 'AGENT') return '人工客服'
  if (senderType === 'SYSTEM') return '系统'
  return '我'
}

export function formatSupportMessageSender(
  message: Pick<SupportMessageVO, 'senderType' | 'senderDisplayName'>,
  perspective: 'customer' | 'agent' = 'customer',
) {
  const name = message.senderDisplayName?.trim()
  if (message.senderType === 'AI') return 'AI 客服'
  if (message.senderType === 'SYSTEM') return '系统'
  if (message.senderType === 'AGENT') return name ? `人工客服（${name}）` : '人工客服'
  if (perspective === 'agent') return name || '用户'
  return '我'
}

export function filterSupportConversations<T extends Pick<SupportConversationVO, 'status'>>(
  conversations: T[],
  filter: SupportConversationFilter,
) {
  if (filter === 'all') return conversations
  if (filter === 'closed') return conversations.filter(item => item.status === 'CLOSED')
  return conversations.filter(item => item.status !== 'CLOSED')
}

export function mergeSupportConversations<T extends Pick<SupportConversationVO, 'id' | 'createTime' | 'updateTime'>>(
  conversations: T[],
): T[] {
  const map = new Map<number, T>()
  for (const item of conversations) {
    map.set(item.id, item)
  }
  return Array.from(map.values()).sort((a, b) => {
    const left = new Date(a.updateTime || a.createTime || 0).getTime()
    const right = new Date(b.updateTime || b.createTime || 0).getTime()
    return right - left
  })
}

export function shouldPollSupportConversation(status: SupportConversationStatus | null | undefined) {
  return status === 'OPEN' || status === 'WAITING_AGENT' || status === 'ASSIGNED' || status === 'CLOSE_REQUESTED'
}

export function canRequestSupportHandoff(conversation: Pick<SupportConversationVO, 'status'> | null | undefined) {
  return conversation?.status === 'OPEN'
}

export function isSupportHelpConversationPath(pathname: string | null | undefined) {
  if (!pathname) return false
  const normalized = pathname.split('?')[0]?.replace(/\/+$/, '') || '/'
  return normalized === '/help'
}

export function pickDefaultUserSupportConversation<T extends Pick<SupportConversationVO, 'id' | 'status' | 'sourceType' | 'assignedAgentId'>>(
  conversations: T[],
  currentUserId?: number | null,
  preferredId?: number | null,
): T | null {
  const active = conversations.filter(item => item.status !== 'CLOSED')
  const realAgentConversation = active.find(item =>
    item.sourceType === 'HUMAN'
    && item.assignedAgentId != null
    && item.assignedAgentId !== currentUserId,
  )
  const preferred = preferredId ? active.find(item => item.id === preferredId) : null
  if (preferred) {
    const preferredIsRealAgent = preferred.sourceType === 'HUMAN'
      && preferred.assignedAgentId != null
      && preferred.assignedAgentId !== currentUserId
    if (preferredIsRealAgent || !realAgentConversation) return preferred
  }
  if (realAgentConversation) return realAgentConversation

  const waitingHuman = active.find(item => item.sourceType === 'HUMAN')
  if (waitingHuman) return waitingHuman

  return active[0] || null
}

export function getSupportConversationRecordsHref() {
  return '/console/support-conversations'
}
