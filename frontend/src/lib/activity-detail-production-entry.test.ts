import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function readSource(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('activity detail recommendations are not hardcoded borrowed activities or poster hosts', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /BY2|胡夏|民谣30年/)
  assert.doesNotMatch(source, /img\.alicdn\.com|p\.damai\.cn/)
})

test('activity detail recommendations use real activity candidates and ranking helper', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.match(source, /listActivities/)
  assert.match(source, /buildActivityDetailRecommendations/)
})

test('activity detail does not show a static placeholder order QR code', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /\/1\.png/)
  assert.doesNotMatch(source, /手机扫一扫|下单更快捷/)
})

test('activity detail uses Chinese team number wording for join prompt', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /小队 ID/)
  assert.match(source, /小队编号/)
})

test('activity detail uses readable ticket fallback instead of ticket type identifiers', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /票档 \$\{ticket\.ticketTypeId\}/)
  assert.doesNotMatch(source, /票档 \$\{attempt\.ticketTypeId\}/)
  assert.match(source, /票档信息待同步/)
})

test('activity detail does not expose review author user identifiers', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /用户 \{item\.userId\}/)
  assert.match(source, /匿名用户/)
})

test('activity detail grab progress status uses Chinese synchronization fallback', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /GRAB_STATUS_LABELS\[grabProgress\.status\] \|\| '未知状态'/)
  assert.match(source, /formatGrabStatusLabel/)
  assert.match(source, /状态同步中/)
})

test('activity detail question answer fallback keeps unknown statuses visible', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /item\.answer \|\| \(item\.status === 'PENDING' \? '已提交，等待回复' : '暂无回复'\)/)
  assert.match(source, /formatActivityQuestionAnswerFallback/)
  assert.match(source, /问答状态同步中/)
})
