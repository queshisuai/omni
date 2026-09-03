import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/subscriptions/page.tsx', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')
const typeSource = readFileSync(new URL('../types/api.ts', import.meta.url), 'utf8')

test('subscriptions empty state uses recent views as sale reminder and artist follow entry', () => {
  assert.match(source, /ACTIVITY_VIEW_SIGNAL_KEY/)
  assert.match(source, /parseActivityViewSignals/)
  assert.match(source, /buildSubscriptionEmptyGuides/)
  assert.match(source, /最近浏览/)
  assert.match(source, /guide\.actionLabel/)
  assert.match(source, /router\.push\(guide\.href\)/)
})

test('subscriptions page uses message center reminders without local calendar export', () => {
  assert.match(source, /候补释放和支付提醒在消息通知中查看/)
  assert.doesNotMatch(source, /导出日历/)
  assert.doesNotMatch(source, /CalendarDays/)
  assert.doesNotMatch(source, /calendarLoading/)
  assert.doesNotMatch(source, /downloadCalendar/)
  assert.doesNotMatch(source, /downloadTextFile/)
  assert.doesNotMatch(source, /text\/calendar/)
  assert.doesNotMatch(source, /\.ics/)
})

test('frontend api does not expose subscription calendar download', () => {
  assert.doesNotMatch(apiSource, /createSubscriptionCalendar/)
  assert.doesNotMatch(apiSource, /subscriptions\/calendar/)
  assert.doesNotMatch(typeSource, /SubscriptionCalendarVO/)
})
