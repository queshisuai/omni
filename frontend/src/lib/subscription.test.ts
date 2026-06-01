import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatSubscriptionTargetType, getCountdownText } from './subscription.ts'

test('formats subscription target types in Chinese', () => {
  assert.equal(formatSubscriptionTargetType('ACTIVITY_WANT'), '想看')
  assert.equal(formatSubscriptionTargetType('SALE_REMINDER'), '开售提醒')
  assert.equal(formatSubscriptionTargetType('WAITLIST_REMINDER'), '候补通知')
  assert.equal(formatSubscriptionTargetType('ARTIST_FOLLOW'), '艺人关注')
  assert.equal(formatSubscriptionTargetType('CITY_FOLLOW'), '城市关注')
  assert.equal(formatSubscriptionTargetType('TOUR_CITY_REMINDER'), '巡演城市提醒')
  assert.equal(formatSubscriptionTargetType('UNKNOWN'), '订阅')
})

test('returns countdown text for future performance time', () => {
  const now = new Date('2026-06-01T10:00:00+08:00').getTime()
  assert.equal(getCountdownText('2026-06-03T12:30:00', now), '2天2小时后')
  assert.equal(getCountdownText('2026-06-01T10:10:00', now), '10分钟后')
  assert.equal(getCountdownText('2026-05-31T10:00:00', now), '已开始')
  assert.equal(getCountdownText(null, now), '时间待定')
})
