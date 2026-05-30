import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canShowPayButton,
  canTriggerTeamGrab,
  normalizeFallbacks,
  strategyLabel,
} from './team-grab.ts'
import type { TicketTeamDetailVO, TicketTeamMemberVO, TicketTeamVO } from '@/types/api'

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
