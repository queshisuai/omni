import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/organizer-ops/page.tsx', import.meta.url), 'utf8')

test('organizer ops page gives traceable identifiers Chinese business context', () => {
  assert.doesNotMatch(source, /主办方 #/)
  assert.doesNotMatch(source, /运营员 #/)
  assert.doesNotMatch(source, /负责人ID/)
  assert.doesNotMatch(source, /主办方 ID/)
  assert.doesNotMatch(source, /ID：/)
  assert.doesNotMatch(source, /操作人\s+\{/)

  assert.match(source, /主办方编号/)
  assert.match(source, /负责人编号/)
  assert.match(source, /运营员编号/)
  assert.match(source, /操作人编号/)
})
