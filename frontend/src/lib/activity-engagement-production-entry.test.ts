import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/activity-engagement/page.tsx', import.meta.url), 'utf8')

test('activity engagement moderation page gives review identifiers Chinese context', () => {
  assert.doesNotMatch(source, /活动 \{review\.activityId\}/)
  assert.doesNotMatch(source, /订单 \{review\.orderId/)
  assert.doesNotMatch(source, /用户 \{review\.userId\}/)
  assert.doesNotMatch(source, /评价 \{report\.reviewId\}/)
  assert.doesNotMatch(source, /活动 \{report\.activityId\}/)
  assert.doesNotMatch(source, /举报用户 \{report\.userId\}/)
  assert.doesNotMatch(source, /活动 \{question\.activityId\}/)
  assert.doesNotMatch(source, /用户 \{question\.userId\}/)

  assert.match(source, /活动编号/)
  assert.match(source, /订单编号/)
  assert.match(source, /用户编号/)
  assert.match(source, /评价编号/)
  assert.match(source, /举报用户编号/)
})

test('activity engagement moderation page does not return unknown status codes directly', () => {
  assert.doesNotMatch(source, /return status/)
  assert.doesNotMatch(source, /return '未知状态'/)
  assert.match(source, /未知评价状态/)
  assert.match(source, /未知问答状态/)
  assert.match(source, /未知举报状态/)
})

test('activity engagement review moderation protects unknown statuses from write actions', () => {
  assert.doesNotMatch(source, /review\.status !== 1 && <button[^>]+APPROVE/)
  assert.doesNotMatch(source, /review\.status !== 2 && <button[^>]+HIDE/)
  assert.doesNotMatch(source, /handleReviewAction\(review\.id, 'APPROVE'\)/)
  assert.doesNotMatch(source, /handleReviewAction\(review\.id, 'HIDE'\)/)
  assert.doesNotMatch(source, /handleReviewAction\(review\.id, 'RESTORE'\)/)
  assert.match(source, /\bcanApproveReview\b/)
  assert.match(source, /\bcanHideReview\b/)
  assert.match(source, /\bcanRestoreReview\b/)
  assert.match(source, /评价状态待核对，请刷新后再操作/)
  assert.match(source, /状态待核对/)
})

test('activity engagement question moderation protects unknown statuses from write actions', () => {
  assert.doesNotMatch(source, /question\.status !== 'HIDDEN'/)
  assert.doesNotMatch(source, /question\.status === 'HIDDEN'/)
  assert.doesNotMatch(source, /handleQuestionAction\(question\.id, 'HIDE'\)/)
  assert.doesNotMatch(source, /handleQuestionAction\(question\.id, 'RESTORE'\)/)
  assert.match(source, /\bisKnownQuestionStatus\b/)
  assert.match(source, /\bcanAnswerQuestion\b/)
  assert.match(source, /\bcanHideQuestion\b/)
  assert.match(source, /\bcanRestoreQuestion\b/)
  assert.match(source, /问答状态待核对，请刷新后再操作/)
  assert.match(source, /状态待核对/)
})

test('activity engagement report moderation protects unknown statuses from write actions', () => {
  assert.doesNotMatch(source, /report\.status === 'PENDING'/)
  assert.match(source, /\bisKnownReportStatus\b/)
  assert.match(source, /\bcanResolveReport\b/)
  assert.match(source, /\bcanRejectReport\b/)
  assert.match(source, /举报状态待核对，请刷新后再操作/)
  assert.match(source, /状态待核对/)
})
