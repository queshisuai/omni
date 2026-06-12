import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canLeaderRemoveTeamMember,
  canShowPayButton,
  canTriggerTeamGrab,
  normalizeFallbacks,
  strategyLabel,
  teamContextSummary,
  teamMemberDisplayName,
  teamMemberSeatAssignmentLabel,
  teamStatusLabel,
} from './team-grab.ts'
import type { TicketTeamDetailVO, TicketTeamMemberVO, TicketTeamVO } from '@/types/api'

type TriggerTeamGrabRefreshHelper = (args: {
  teamId: number
  triggerTeamGrab: (teamId: number) => Promise<{ requestId: string }>
  loadTeam: () => Promise<void>
  setRequestId: (requestId: string) => void
  clearProgress: () => void
  showError: (message: string) => Promise<void>
  fallbackErrorMessage: string
}) => Promise<void>

function makeTeam(overrides: Partial<TicketTeamVO> = {}): TicketTeamVO {
  return {
    id: 1,
    inviteCode: 'TEAM1',
    leaderUserId: 10,
    activityId: 20,
    sessionId: 30,
    ticketTypeId: 40,
    size: 2,
    strategy: 'STRICT_CONTIGUOUS',
    fallbacks: [],
    status: 'DRAFT',
    ...overrides,
  }
}

function makeMember(overrides: Partial<TicketTeamMemberVO> = {}): TicketTeamMemberVO {
  return {
    id: 1,
    teamId: 1,
    userId: 10,
    role: 'MEMBER',
    status: 'JOINED',
    seatId: null,
    orderSeatId: null,
    seatLabel: null,
    joinTime: '2026-05-31T00:00:00.000Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<TicketTeamDetailVO> = {}): TicketTeamDetailVO {
  return {
    team: makeTeam(),
    members: [],
    canTriggerGrab: false,
    canPay: false,
    latestGrabRequestId: null,
    latestOrderId: null,
    ...overrides,
  }
}

test('labels strict contiguous strategy', () => {
  assert.equal(strategyLabel('STRICT_CONTIGUOUS'), '优先连座')
})

test('uses Chinese fallback for unknown team strategy and status', () => {
  assert.equal(strategyLabel('FUTURE_STRATEGY' as never), '未知策略')
  assert.equal(teamStatusLabel('FUTURE_STATUS' as never), '状态同步中')
})

test('keeps looser fallbacks in their original order', () => {
  assert.deepEqual(
    normalizeFallbacks('STRICT_CONTIGUOUS', ['SAME_BLOCK', 'SAME_TICKET_TYPE']),
    ['SAME_BLOCK', 'SAME_TICKET_TYPE'],
  )
})

test('sorts fallback strategies from strict to loose', () => {
  assert.deepEqual(
    normalizeFallbacks('STRICT_CONTIGUOUS', ['SAME_TICKET_TYPE', 'SAME_BLOCK']),
    ['SAME_BLOCK', 'SAME_TICKET_TYPE'],
  )
})

test('removes duplicate, fallback, and primary fallback strategies', () => {
  assert.deepEqual(
    normalizeFallbacks('STRICT_CONTIGUOUS', [
      'STRICT_CONTIGUOUS',
      'SAME_BLOCK',
      'SAME_BLOCK',
      'FALLBACK',
      'SAME_TICKET_TYPE',
    ]),
    ['SAME_BLOCK', 'SAME_TICKET_TYPE'],
  )
})

test('removes fallbacks stricter than the primary strategy', () => {
  assert.deepEqual(
    normalizeFallbacks('SAME_BLOCK', ['STRICT_CONTIGUOUS', 'SAME_TICKET_TYPE']),
    ['SAME_TICKET_TYPE'],
  )
})

test('shows pay button only to the leader when the team is locked', () => {
  assert.equal(canShowPayButton(makeTeam({ status: 'LOCKED', leaderUserId: 10 }), 10), true)
  assert.equal(canShowPayButton(makeTeam({ status: 'READY', leaderUserId: 10 }), 10), false)
  assert.equal(canShowPayButton(makeTeam({ status: 'LOCKED', leaderUserId: 10 }), 11), false)
})

test('allows triggering only when current user is confirmed and backend allows it', () => {
  assert.equal(
    canTriggerTeamGrab(makeDetail({
      canTriggerGrab: true,
      members: [makeMember({ userId: 10, status: 'CONFIRMED' })],
    }), 10),
    true,
  )
  assert.equal(
    canTriggerTeamGrab(makeDetail({
      canTriggerGrab: false,
      members: [makeMember({ userId: 10, status: 'CONFIRMED' })],
    }), 10),
    false,
  )
  assert.equal(
    canTriggerTeamGrab(makeDetail({
      canTriggerGrab: true,
      members: [makeMember({ userId: 10, status: 'JOINED' })],
    }), 10),
    false,
  )
})

test('refreshes team detail when triggering team grab fails after an unknown publish outcome', async () => {
  const teamGrabModule = await import('./team-grab.ts') as typeof import('./team-grab.ts') & {
    triggerTeamGrabWithRecovery?: TriggerTeamGrabRefreshHelper
  }
  assert.equal(typeof teamGrabModule.triggerTeamGrabWithRecovery, 'function')

  const calls: string[] = []
  await teamGrabModule.triggerTeamGrabWithRecovery!({
    teamId: 1,
    triggerTeamGrab: async (teamId) => {
      calls.push(`trigger:${teamId}`)
      throw new Error('publish failed')
    },
    loadTeam: async () => {
      calls.push('loadTeam')
    },
    setRequestId: (requestId) => {
      calls.push(`requestId:${requestId}`)
    },
    clearProgress: () => {
      calls.push('clearProgress')
    },
    showError: async (message) => {
      calls.push(`alert:${message}`)
    },
    fallbackErrorMessage: 'fallback trigger error',
  })

  assert.deepEqual(calls, [
    'clearProgress',
    'trigger:1',
    'loadTeam',
    'alert:publish failed',
  ])
})

test('uses readable team seat labels before opaque ids', () => {
  assert.equal(
    teamMemberSeatAssignmentLabel(makeMember({ seatId: 501, orderSeatId: 7001, seatLabel: 'A-1' })),
    'A-1',
  )
  assert.equal(
    teamMemberSeatAssignmentLabel(makeMember({ seatId: 501, orderSeatId: 7001, seatLabel: null })),
    '座位确认中',
  )
  assert.equal(teamMemberSeatAssignmentLabel(makeMember({ seatId: 501, orderSeatId: 7001, seatLabel: null })).includes('501'), false)
  assert.equal(teamMemberSeatAssignmentLabel(makeMember()), '')
})

test('builds member display names without exposing user ids', () => {
  assert.equal(teamMemberDisplayName(makeMember({ userId: 10 }), { leaderUserId: 10, currentUserId: 11, index: 0 }), '队长')
  assert.equal(teamMemberDisplayName(makeMember({ userId: 11 }), { leaderUserId: 10, currentUserId: 11, index: 1 }), '我')
  assert.equal(teamMemberDisplayName(makeMember({ userId: 12 }), { leaderUserId: 10, currentUserId: 11, index: 2 }), '成员 3')
})

test('leader can remove non-leader members only while the team is editable', () => {
  assert.equal(
    canLeaderRemoveTeamMember(makeTeam({ status: 'READY', leaderUserId: 10 }), 10, makeMember({ userId: 11, status: 'CONFIRMED' })),
    true,
  )
  assert.equal(
    canLeaderRemoveTeamMember(makeTeam({ status: 'GRABBING', leaderUserId: 10 }), 10, makeMember({ userId: 11, status: 'CONFIRMED' })),
    false,
  )
  assert.equal(
    canLeaderRemoveTeamMember(makeTeam({ status: 'READY', leaderUserId: 10 }), 11, makeMember({ userId: 12, status: 'CONFIRMED' })),
    false,
  )
  assert.equal(
    canLeaderRemoveTeamMember(makeTeam({ status: 'READY', leaderUserId: 10 }), 10, makeMember({ userId: 10, role: 'LEADER', status: 'CONFIRMED' })),
    false,
  )
})

test('builds readable team context summary from ticket context before ids', () => {
  const summary = teamContextSummary(makeTeam({
    activityName: '周末演唱会',
    ticketTypeName: '看台 A',
    venueName: '万象体育馆',
    sessionTime: '2026-07-18T19:30:00',
  }))

  assert.equal(summary.title, '周末演唱会')
  assert.deepEqual(summary.meta, ['2026-07-18 19:30', '看台 A', '万象体育馆'])
  assert.equal(summary.meta.join(' ').includes('场次 30'), false)
  assert.equal(summary.meta.join(' ').includes('票档 40'), false)
})

test('falls back to synchronization labels instead of opaque ids when team context is missing', () => {
  const summary = teamContextSummary(makeTeam())

  assert.equal(summary.title, '活动信息同步中')
  assert.deepEqual(summary.meta, ['场次信息同步中', '票档信息同步中'])
  assert.equal(summary.meta.join(' ').includes('30'), false)
  assert.equal(summary.meta.join(' ').includes('40'), false)
})
