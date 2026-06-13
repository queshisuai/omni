import type { SupportContextVO, SupportConversationVO, SupportMessageVO, SupportTagCode, UserRole } from '@/types/api'
import { getDefaultConsolePath, shouldDefaultToConsoleAfterLogin } from './console-auth.ts'

export type SupportConversationStatus = 'OPEN' | 'WAITING_AGENT' | 'ASSIGNED' | 'CLOSE_REQUESTED' | 'CLOSED' | string
export type SupportConversationFilter = 'active' | 'closed' | 'all'
export type SupportQueueFilter = 'pending' | 'in_progress' | 'overdue' | 'close_requested' | 'closed'

const SUPPORT_TAG_OPTIONS: Array<{ value: SupportTagCode; label: string }> = [
  { value: 'REFUND', label: '退款' },
  { value: 'TICKET', label: '票务' },
  { value: 'ADMISSION', label: '入场' },
  { value: 'ACCOUNT', label: '账号' },
  { value: 'PAYMENT_EXCEPTION', label: '支付异常' },
]

const SUPPORT_AUDIT_ACTION_LABELS: Record<string, string> = {
  TAG_UPDATED: '更新标签',
  TRANSFERRED: '转接客服',
  ESCALATED: '升级管理员',
  CLOSE_REQUESTED: '申请结束',
  CLOSE_REJECTED: '拒绝结束',
  CLOSED_CONFIRMED: '确认结束',
  AUTO_CLOSED: '自动结束',
}

const SUPPORT_CONTEXT_SECTION_LABELS: Record<string, string> = {
  orders: '订单',
  refunds: '退款',
  tickets: '票夹',
  waitlist: '候补',
  grabRequests: '抢票',
  notifications: '通知',
}

const KNOWN_SUPPORT_CONVERSATION_STATUSES = new Set(['OPEN', 'WAITING_AGENT', 'ASSIGNED', 'CLOSE_REQUESTED', 'CLOSED'])

export function getLoginRedirectForRole(role: UserRole | string | null | undefined, permissionCodes: string[] = []) {
  if (shouldDefaultToConsoleAfterLogin(role, permissionCodes)) return getDefaultConsolePath(role, permissionCodes)
  if (role === 'support') return '/support'
  return '/'
}

export function formatSupportConversationStatus(status: SupportConversationStatus) {
  if (status === 'OPEN') return 'AI 服务中'
  if (status === 'WAITING_AGENT') return '人工介入请等待'
  if (status === 'ASSIGNED') return '人工处理中'
  if (status === 'CLOSE_REQUESTED') return '等待用户确认结束'
  if (status === 'CLOSED') return '已结束'
  return '未知会话状态'
}

export function isKnownSupportConversationStatus(status: SupportConversationStatus | null | undefined) {
  return typeof status === 'string' && KNOWN_SUPPORT_CONVERSATION_STATUSES.has(status)
}

export function canClaimSupportConversation(status: SupportConversationStatus | null | undefined) {
  return status === 'OPEN' || status === 'WAITING_AGENT'
}

export function canReplySupportConversation(status: SupportConversationStatus | null | undefined) {
  return status === 'ASSIGNED' || status === 'CLOSE_REQUESTED'
}

export function canEditSupportConversation(status: SupportConversationStatus | null | undefined) {
  return isKnownSupportConversationStatus(status) && status !== 'CLOSED'
}

export function canRequestSupportClose(status: SupportConversationStatus | null | undefined) {
  return isKnownSupportConversationStatus(status) && status !== 'CLOSED' && status !== 'CLOSE_REQUESTED'
}

export function canConfirmSupportConversationClose(status: SupportConversationStatus | null | undefined) {
  return status === 'CLOSE_REQUESTED'
}

export function formatSupportConversationWriteBlockedMessage(status: SupportConversationStatus | null | undefined) {
  return isKnownSupportConversationStatus(status) ? '' : '会话状态待核对，请刷新后再操作'
}

export function formatSupportTagLabel(code: string | null | undefined) {
  if (!code) return ''
  return SUPPORT_TAG_OPTIONS.find(item => item.value === code)?.label ?? '未知标签'
}

export function getSupportTagOptions() {
  return [...SUPPORT_TAG_OPTIONS]
}

export function formatSupportAuditAction(action: string | null | undefined) {
  if (!action) return ''
  return SUPPORT_AUDIT_ACTION_LABELS[action] ?? '未知操作'
}

export function formatSupportContextSectionCount(section: string, count: number) {
  return `${SUPPORT_CONTEXT_SECTION_LABELS[section] ?? '未知上下文'} ${count}`
}

export function hasSupportContextData(context: SupportContextVO | null | undefined) {
  if (!context) return false
  return Boolean(
    context.orders.length ||
    context.refunds.length ||
    context.tickets.length ||
    context.waitlist.length ||
    context.grabRequests.length ||
    context.notifications.length,
  )
}

export function buildCloseRequestMessage(reason?: string | null) {
  const trimmed = reason?.trim()
  return trimmed ? `人工客服申请结束会话，原因：${trimmed}` : '人工客服申请结束会话，请确认是否结束。'
}

export function appendQuickReply(current: string | null | undefined, content: string | null | undefined) {
  const next = content?.trim()
  if (!next) return current || ''
  const existing = current?.trim()
  return existing ? `${existing}\n${next}` : next
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

export function getSupportQueueTabs(conversations: SupportConversationVO[]) {
  const tabs: Array<{ value: SupportQueueFilter; label: string; count: number }> = [
    { value: 'pending', label: '待处理', count: 0 },
    { value: 'in_progress', label: '处理中', count: 0 },
    { value: 'overdue', label: '超时', count: 0 },
    { value: 'close_requested', label: '已申请结束', count: 0 },
    { value: 'closed', label: '已关闭', count: 0 },
  ]
  for (const item of conversations) {
    if (item.status === 'CLOSED') tabs[4].count += 1
    else if (item.slaOverdue) tabs[2].count += 1
    else if (item.status === 'WAITING_AGENT') tabs[0].count += 1
    else if (item.status === 'CLOSE_REQUESTED') tabs[3].count += 1
    else if (item.status === 'ASSIGNED') tabs[1].count += 1
  }
  return tabs
}

export function sortSupportConversationsForQueue<T extends Pick<SupportConversationVO, 'slaOverdue' | 'updateTime' | 'createTime'>>(items: T[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.slaOverdue) !== Boolean(b.slaOverdue)) return a.slaOverdue ? -1 : 1
    const left = new Date(a.updateTime || a.createTime || 0).getTime()
    const right = new Date(b.updateTime || b.createTime || 0).getTime()
    return right - left
  })
}

export function formatSupportSlaText(conversation: SupportConversationVO, now = new Date()) {
  if (conversation.userWaitingSeconds && conversation.userWaitingSeconds > 0) {
    return `用户已等待 ${Math.ceil(conversation.userWaitingSeconds / 60)} 分钟`
  }
  if (conversation.firstResponseDueAt && !conversation.firstAgentRepliedAt) {
    const due = new Date(conversation.firstResponseDueAt).getTime()
    const remainingMinutes = Math.max(0, Math.ceil((due - now.getTime()) / 60000))
    return conversation.slaOverdue ? '首次响应已超时' : `首次响应剩余 ${remainingMinutes} 分钟`
  }
  if (conversation.lastAgentMessageAt) return `最后回复：${formatSupportRelativeMinute(conversation.lastAgentMessageAt, now)}`
  return '等待会话更新'
}

function formatSupportRelativeMinute(value: string, now: Date) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const minutes = Math.max(0, Math.floor((now.getTime() - time) / 60000))
  return minutes === 0 ? '刚刚' : `${minutes} 分钟前`
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

export function pickLatestSupportConversation<T extends Pick<SupportConversationVO, 'id' | 'createTime' | 'updateTime'>>(
  current: T | null,
  conversations: T[],
): T | null {
  if (conversations.length === 0) return null
  if (current) {
    const latest = conversations.find(item => item.id === current.id)
    if (latest) return latest
  }
  return mergeSupportConversations(conversations)[0] || null
}

export function shouldPollSupportConversation(status: SupportConversationStatus | null | undefined) {
  return status === 'OPEN' || status === 'WAITING_AGENT' || status === 'ASSIGNED' || status === 'CLOSE_REQUESTED'
}

export function canRequestSupportHandoff(conversation: Pick<SupportConversationVO, 'status'> | null | undefined) {
  return conversation?.status === 'OPEN'
}

export function formatSupportHandoffActionLabel(status: SupportConversationStatus | null | undefined) {
  if (status === 'WAITING_AGENT') return '人工介入请等待'
  if (status === 'ASSIGNED') return '人工客服处理中'
  if (status === 'CLOSE_REQUESTED') return '等待你确认是否结束'
  if (status && status !== 'OPEN' && status !== 'CLOSED') return '状态待核对'
  return '转人工客服'
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
