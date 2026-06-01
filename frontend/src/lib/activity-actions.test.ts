import test from 'node:test'
import assert from 'node:assert/strict'

import { getActivitySubscriptionActions, isActivityOnSale } from './activity-actions.ts'

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
