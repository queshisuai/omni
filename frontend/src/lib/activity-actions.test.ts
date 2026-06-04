import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findActivitySubscriptionAction,
  getActivitySubscriptionActionLabel,
  getActivitySubscriptionActions,
  isActivityOnSale,
  removeActivitySubscriptionById,
  upsertActivitySubscription,
} from './activity-actions.ts'

test('treats status 1 activity as on sale', () => {
  assert.equal(isActivityOnSale({ status: 1 }), true)
  assert.equal(isActivityOnSale({ status: 2 }), false)
})

test('hides sale reminder and waitlist reminder from top actions for on-sale activity', () => {
  assert.deepEqual(getActivitySubscriptionActions({ status: 1 }).map(item => item.type), [
    'ACTIVITY_WANT',
    'ARTIST_FOLLOW',
    'CALENDAR',
  ])
})

test('shows sale reminder before sale and never shows waitlist reminder in top actions', () => {
  assert.deepEqual(getActivitySubscriptionActions({ status: 2 }).map(item => item.type), [
    'ACTIVITY_WANT',
    'SALE_REMINDER',
    'ARTIST_FOLLOW',
    'CALENDAR',
  ])
})

test('finds active activity and artist subscriptions for detail actions', () => {
  const subscriptions = [
    { id: 11, targetType: 'ACTIVITY_WANT', targetId: 1001, activityId: 1001, status: 1 },
    { id: 12, targetType: 'ARTIST_FOLLOW', targetId: 2002, artistId: 2002, status: 1 },
    { id: 13, targetType: 'SALE_REMINDER', targetId: 1002, activityId: 1002, status: 1 },
    { id: 14, targetType: 'ACTIVITY_WANT', targetId: 1001, activityId: 1001, status: 0 },
  ]

  assert.equal(findActivitySubscriptionAction('ACTIVITY_WANT', subscriptions, { activityId: 1001 })?.id, 11)
  assert.equal(findActivitySubscriptionAction('ARTIST_FOLLOW', subscriptions, { artistId: 2002 })?.id, 12)
  assert.equal(findActivitySubscriptionAction('SALE_REMINDER', subscriptions, { activityId: 1001 }), null)
})

test('uses subscribed labels for activity detail actions', () => {
  const actions = getActivitySubscriptionActions({ status: 1 })

  assert.equal(getActivitySubscriptionActionLabel(actions[0], { active: true }), '已想看')
  assert.equal(getActivitySubscriptionActionLabel(actions[1], { active: true }), '已关注')
  assert.equal(getActivitySubscriptionActionLabel(actions[2], { active: true }), '已加入日历')
  assert.equal(getActivitySubscriptionActionLabel(actions[1], { loading: true, active: true }), '取消中...')
})

test('updates subscription state after create and cancel', () => {
  const initial = [{ id: 11, targetType: 'ACTIVITY_WANT', targetId: 1001, status: 1 }]
  const updated = upsertActivitySubscription(initial, { id: 12, targetType: 'ARTIST_FOLLOW', targetId: 2002, status: 1 })
  const replaced = upsertActivitySubscription(updated, { id: 11, targetType: 'ACTIVITY_WANT', targetId: 1001, status: 1, activityId: 1001 })

  assert.deepEqual(updated.map(item => item.id), [12, 11])
  assert.equal(replaced.length, 2)
  assert.equal(replaced.find(item => item.id === 11)?.activityId, 1001)
  assert.deepEqual(removeActivitySubscriptionById(replaced, 12).map(item => item.id), [11])
})
