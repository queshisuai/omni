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

test('activity engagement page renders activity aggregate table with filters and shared pagination', () => {
  assert.match(source, /listAdminActivityEngagements/)
  assert.match(source, /GlobalPagination/)
  assert.match(source, /活动关键字/)
  assert.match(source, /普通活动/)
  assert.match(source, /大型巡演/)
  assert.match(source, /仅看有待办/)
  assert.match(source, /待审核数/)
  assert.match(source, /待回复数/)
  assert.match(source, /举报待办数/)
  assert.match(source, /管理互动/)
})

test('activity engagement drawer loads activity scoped tabs', () => {
  assert.match(source, /Drawer/)
  assert.match(source, /selectedTarget/)
  assert.match(source, /购前问答/)
  assert.match(source, /评价管理（先审后发）/)
  assert.match(source, /违规举报/)
  assert.match(source, /listAdminActivityQuestions\(selectedTarget\.targetId/)
  assert.match(source, /listAdminActivityReviews\(selectedTarget\.targetId/)
  assert.match(source, /listAdminActivityReviewReports\(selectedTarget\.targetId/)
  assert.match(source, /当前前台评分/)
})

test('activity engagement page requires audit reason for destructive super admin actions', () => {
  assert.match(source, /auditModal/)
  assert.match(source, /操作原因\/备注/)
  assert.match(source, /请填写操作原因\/备注/)
  assert.match(source, /updateAdminActivityQuestion/)
  assert.match(source, /updateAdminActivityReviewStatus/)
  assert.match(source, /updateAdminActivityReportStatus/)
})

test('activity engagement question replies expose Chinese identity choices', () => {
  assert.match(source, /OFFICIAL_SUPPORT/)
  assert.match(source, /ORGANIZER_PROXY/)
  assert.match(source, /平台官方客服/)
  assert.match(source, /代主办方/)
})

test('activity engagement page keeps request wrapper and avoids axios', () => {
  assert.doesNotMatch(source, /axios/i)
  assert.match(source, /@\/lib\/api/)
})
