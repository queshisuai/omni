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

test('activity detail top actions use lightweight toast states without calendar file download', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.doesNotMatch(source, /createSubscriptionCalendar/)
  assert.doesNotMatch(source, /new Blob\(/)
  assert.doesNotMatch(source, /URL\.createObjectURL/)
  assert.doesNotMatch(source, /\.download =/)
  assert.match(source, /showCenterToast/)
  assert.match(source, /关注成功/)
  assert.match(source, /已标记想看/)
  assert.match(source, /已加入日程提醒/)
  assert.match(source, /bg-black\/30/)
  assert.match(source, /bg-black\/80/)
})

test('activity detail seat area and tabs use compact modern detail layout', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.match(source, /座位暂不公布，座位将在下单后由系统自动分配。/)
  assert.match(source, /#FAFBFD/)
  assert.match(source, /#F4F5F7/)
  assert.match(source, /限购政策/)
  assert.match(source, /实名规则/)
  assert.match(source, /转赠支持/)
  assert.match(source, /退换说明/)
  assert.match(source, /提前 60 分钟到达/)
  assert.match(source, /入场核验/)
  assert.match(source, /迟到观众安排/)
  assert.match(source, /严禁携带物品/)
  assert.match(source, /安全文明观演/)
})

test('activity detail comments are audience hot reviews without write review entry', () => {
  const source = readSource('app/activity/[id]/page.tsx')

  assert.match(source, /观众热评/)
  assert.match(source, /已购实名票/)
  assert.match(source, /演出问答区/)
  assert.match(source, /我要提问/)
  assert.doesNotMatch(source, /评价与问答/)
  assert.doesNotMatch(source, /去订单页评价/)
  assert.doesNotMatch(source, /写评价/)
  assert.doesNotMatch(source, /handleSubmitReview/)
  assert.doesNotMatch(source, /createActivityReview/)
})

test('activity detail branches cleanly between tour stations and single event purchase states', () => {
  const source = readSource('app/activity/[id]/page.tsx')
  const apiTypes = readSource('types/api.ts')

  assert.match(source, /selectedStationId/)
  assert.match(source, /isTourEvent/)
  assert.match(source, /eventType/)
  assert.match(source, /Tour Stations Selector/)
  assert.match(source, /巡演项目/)
  assert.match(source, /售票中/)
  assert.match(source, /预约中/)
  assert.match(source, /待公布/)
  assert.match(source, /缺货登记/)
  assert.match(source, /\+ 求加场/)
  assert.match(source, /overflow-x-auto/)
  assert.match(source, /scrollbar-hide/)
  assert.match(source, /ACTIVE/)
  assert.match(source, /PENDING/)
  assert.match(source, /RESERVING/)
  assert.match(source, /演出筹备中/)
  assert.match(source, /时间待公布/)
  assert.match(source, /本站演出场馆、具体时间及票档区间正由主办方积极筹备中/)
  assert.match(source, /开启开售提醒/)
  assert.match(source, /已开启开售提醒/)
  assert.match(source, /已成功订阅，开票前将短信提醒！/)
  assert.match(source, /登记想看意向/)
  assert.match(source, /stationPurchaseState/)
  assert.match(source, /selectedStationDetail/)
  assert.match(source, /activePurchaseSessions/)

  assert.match(apiTypes, /isTour\?: boolean/)
  assert.match(apiTypes, /eventType\?: 'TOUR' \| 'SINGLE' \| string/)
  assert.match(apiTypes, /tour\?: TourEntity \| null/)
  assert.match(apiTypes, /stationDetails\?: StationPurchaseDetail\[\]/)
})

test('activity detail uses shared floating back button with cached search return state and analytics', () => {
  const source = readSource('app/activity/[id]/page.tsx')
  const component = readSource('components/FloatingBackButton.tsx')

  assert.match(source, /FloatingBackButton/)
  assert.match(source, /pendingInteraction=\{showConfirm \|\| grabProgressOpen \|\| Boolean\(pagePay\)\}/)
  assert.match(source, /omni_activity_detail_back_clicked/)

  assert.match(component, /返回上一页/)
  assert.match(component, /fixed left-6 top-24/)
  assert.match(component, /hidden lg:flex/)
  assert.match(component, /captureAnalyticsEvent/)
  assert.match(component, /readSearchReturnState/)
  assert.match(component, /markSearchReturnPending/)
  assert.match(component, /document\.referrer\.includes\(window\.location\.host\)/)
  assert.match(component, /router\.back\(\)/)
  assert.match(component, /router\.push\(fallbackHref\)/)
  assert.doesNotMatch(component, /window\.history\.back\(\)/)
})
