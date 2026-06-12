import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/search/page.tsx', import.meta.url), 'utf8')

test('search sidebar recommendations use recent view signals instead of raw result slice', () => {
  assert.match(source, /ACTIVITY_VIEW_SIGNAL_KEY/)
  assert.match(source, /parseActivityViewSignals/)
  assert.match(source, /buildSearchSidebarRecommendations/)
  assert.doesNotMatch(source, /activities\.slice\(0,\s*4\)\.map/)
})

test('search empty state exposes recent viewed activities as recall terms', () => {
  assert.match(source, /viewSignals/)
  assert.match(source, /recentTerms/)
  assert.match(source, /最近浏览/)
})

test('search suggestions receive recent view signals', () => {
  assert.match(source, /const suggestions = buildSearchSuggestions\(\{[\s\S]*viewSignals,[\s\S]*limit: 8/)
})
