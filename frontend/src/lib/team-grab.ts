import type {
  TeamSeatStrategy,
  TeamStatus,
  TeamGrabTriggerResult,
  TicketTeamDetailVO,
  TicketTeamMemberVO,
  TicketTeamVO,
} from '@/types/api'

export const TEAM_STRATEGY_OPTIONS: TeamSeatStrategy[] = [
  'STRICT_CONTIGUOUS',
  'SAME_BLOCK',
  'SAME_TICKET_TYPE',
  'FALLBACK',
]

const STRATEGY_LABELS: Record<TeamSeatStrategy, string> = {
  STRICT_CONTIGUOUS: '优先连座',
  SAME_BLOCK: '同区即可',
  SAME_TICKET_TYPE: '同票档即可',
  FALLBACK: '自动保底',
}

const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  DRAFT: '待组队',
  READY: '已就绪',
  GRABBING: '抢票中',
  LOCKED: '已锁票',
  PAID: '已支付',
  FAILED: '失败',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
}

const STRATEGY_RANK: Record<TeamSeatStrategy, number> = {
  STRICT_CONTIGUOUS: 0,
  SAME_BLOCK: 1,
  SAME_TICKET_TYPE: 2,
  FALLBACK: 3,
}

const EDITABLE_TEAM_STATUSES = new Set<TeamStatus>(['DRAFT', 'READY', 'FAILED', 'EXPIRED'])

type TriggerTeamGrabWithRecoveryArgs = {
  teamId: number
  triggerTeamGrab: (teamId: number) => Promise<TeamGrabTriggerResult>
  loadTeam: () => Promise<void>
  setRequestId: (requestId: string) => void
  clearProgress: () => void
  showError: (message: string) => Promise<void>
  fallbackErrorMessage: string
}

function formatDisplayTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function readableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

export function strategyLabel(strategy: string) {
  return STRATEGY_LABELS[strategy as TeamSeatStrategy] || '未知策略'
}

export function teamStatusLabel(status: string) {
  return TEAM_STATUS_LABELS[status as TeamStatus] || '状态同步中'
}

export function normalizeFallbacks(primary: TeamSeatStrategy, fallbacks: TeamSeatStrategy[]) {
  const seen = new Set<TeamSeatStrategy>()

  return fallbacks
    .filter((fallback) => {
      if (seen.has(fallback)) return false
      seen.add(fallback)
      if (fallback === 'FALLBACK') return false
      if (fallback === primary) return false
      return STRATEGY_RANK[fallback] > STRATEGY_RANK[primary]
    })
    .sort((left, right) => STRATEGY_RANK[left] - STRATEGY_RANK[right])
}

export function defaultTeamFallbacks(primary: TeamSeatStrategy) {
  return normalizeFallbacks(primary, ['SAME_BLOCK', 'SAME_TICKET_TYPE'])
}

export function canShowPayButton(team: TicketTeamVO, currentUserId: number) {
  return team.status === 'LOCKED' && team.leaderUserId === currentUserId
}

export function teamContextSummary(team: TicketTeamVO) {
  const hasActivityContext = Boolean(readableText(team.activityName))
  const title = readableText(team.activityName) ?? '活动信息同步中'
  const meta = [
    formatDisplayTime(team.sessionTime) ?? (!hasActivityContext ? '场次信息同步中' : null),
    readableText(team.ticketTypeName) ?? (!hasActivityContext ? '票档信息同步中' : null),
    readableText(team.venueName),
  ].filter((item): item is string => Boolean(item))

  return { title, meta }
}

export function canTriggerTeamGrab(detail: TicketTeamDetailVO, currentUserId: number) {
  return detail.canTriggerGrab && detail.members.some((member) => (
    member.userId === currentUserId && member.status === 'CONFIRMED'
  ))
}

export async function triggerTeamGrabWithRecovery({
  teamId,
  triggerTeamGrab,
  loadTeam,
  setRequestId,
  clearProgress,
  showError,
  fallbackErrorMessage,
}: TriggerTeamGrabWithRecoveryArgs) {
  clearProgress()

  let result: TeamGrabTriggerResult
  try {
    result = await triggerTeamGrab(teamId)
  } catch (err: unknown) {
    await loadTeam()
    await showError(err instanceof Error ? err.message : fallbackErrorMessage)
    return
  }

  setRequestId(result.requestId)
  await loadTeam()
}

export function confirmedMemberCount(members: TicketTeamMemberVO[]) {
  return members.filter((member) => member.status === 'CONFIRMED').length
}

export function teamMemberSeatAssignmentLabel(member: TicketTeamMemberVO) {
  const readableLabel = member.seatLabel?.trim()
  if (readableLabel) return readableLabel
  if (member.seatId != null || member.orderSeatId != null) return '座位确认中'

  return ''
}

export function teamMemberDisplayName(
  member: TicketTeamMemberVO,
  context: { leaderUserId: number; currentUserId?: number | null; index: number },
) {
  if (context.currentUserId === member.userId) return '我'
  if (context.leaderUserId === member.userId) return '队长'
  return `成员 ${context.index + 1}`
}

export function canLeaderRemoveTeamMember(team: TicketTeamVO, currentUserId: number | null | undefined, member: TicketTeamMemberVO) {
  return currentUserId === team.leaderUserId
    && EDITABLE_TEAM_STATUSES.has(team.status)
    && member.userId !== team.leaderUserId
    && member.status !== 'LEFT'
}
