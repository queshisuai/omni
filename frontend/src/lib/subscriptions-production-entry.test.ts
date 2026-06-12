import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/subscriptions/page.tsx', import.meta.url), 'utf8')

test('subscriptions empty state uses recent views as sale reminder and artist follow entry', () => {
  assert.match(source, /ACTIVITY_VIEW_SIGNAL_KEY/)
  assert.match(source, /parseActivityViewSignals/)
  assert.match(source, /buildSubscriptionEmptyGuides/)
  assert.match(source, /最近浏览/)
  assert.match(source, /guide\.actionLabel/)
  assert.match(source, /router\.push\(guide\.href\)/)
})
