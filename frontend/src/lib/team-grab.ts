import type {
  TeamSeatStrategy,
  TeamStatus,
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

export function strategyLabel(strategy: TeamSeatStrategy) {
  return STRATEGY_LABELS[strategy]
}

export function teamStatusLabel(status: TeamStatus) {
  return TEAM_STATUS_LABELS[status]
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

export function canTriggerTeamGrab(detail: TicketTeamDetailVO, currentUserId: number) {
  return detail.canTriggerGrab && detail.members.some((member) => (
    member.userId === currentUserId && member.status === 'CONFIRMED'
  ))
}

export function confirmedMemberCount(members: TicketTeamMemberVO[]) {
  return members.filter((member) => member.status === 'CONFIRMED').length
}
