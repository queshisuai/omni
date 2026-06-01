import type { UserRole } from '@/types/api'

export type SupportConversationStatus = 'OPEN' | 'WAITING_AGENT' | 'ASSIGNED' | 'CLOSED' | string

export function getLoginRedirectForRole(role: UserRole | string | null | undefined) {
  if (role === 'support') return '/support'
  if (role === 'admin' || role === 'organizer') return '/console'
  return '/'
}

export function formatSupportConversationStatus(status: SupportConversationStatus) {
  if (status === 'OPEN') return 'AI 服务中'
  if (status === 'WAITING_AGENT') return '等待人工接入'
  if (status === 'ASSIGNED') return '人工处理中'
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
