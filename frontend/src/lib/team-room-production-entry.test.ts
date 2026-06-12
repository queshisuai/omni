import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../app/teams/[id]/page.tsx', import.meta.url), 'utf8')
const memberListSource = readFileSync(new URL('../components/team-grab/TeamMemberList.tsx', import.meta.url), 'utf8')

test('team room avoids exposing opaque ids as primary user-facing text', () => {
  assert.doesNotMatch(pageSource, /小队房间 #\{team\.id\}/)
  assert.doesNotMatch(pageSource, /小队 ID/)
  assert.doesNotMatch(pageSource, /requestId \{requestId\}/)
  assert.doesNotMatch(pageSource, /订单 \{detail\.latestOrderId\}/)
  assert.doesNotMatch(pageSource, /用户 \{member\.userId\}/)
  assert.match(pageSource, /抢票进度同步中/)
})

test('team member list renders member labels without raw user ids', () => {
  assert.match(memberListSource, /teamMemberDisplayName/)
  assert.doesNotMatch(memberListSource, /用户 \{member\.userId\}/)
})

test('team member list uses Chinese fallback for unknown member status', () => {
  assert.doesNotMatch(memberListSource, /MEMBER_STATUS_LABELS\[member\.status\]\}/)
  assert.match(memberListSource, /formatTeamMemberStatus/)
  assert.match(memberListSource, /状态同步中/)
})

test('team room grab progress status uses Chinese fallback for unknown codes', () => {
  assert.doesNotMatch(pageSource, /GRAB_STATUS_LABELS\[progress\.status\]/)
  assert.match(pageSource, /formatGrabProgressStatus/)
  assert.match(pageSource, /状态同步中/)
})
