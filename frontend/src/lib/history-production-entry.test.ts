import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/history/page.tsx', import.meta.url), 'utf8')

test('history page uses readable activity fallback instead of activity identifiers', () => {
  assert.doesNotMatch(source, /演出 \$\{item\.activityId\}/)
  assert.match(source, /演出信息待同步/)
})
