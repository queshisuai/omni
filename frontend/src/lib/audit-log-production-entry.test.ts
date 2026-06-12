import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/audit-logs/page.tsx', import.meta.url), 'utf8')

test('audit log filters use Chinese business labels for traceable identifiers', () => {
  assert.doesNotMatch(source, /操作人\s*ID/)
  assert.doesNotMatch(source, />操作人<\/th>/)
  assert.doesNotMatch(source, /\{item\.operatorId\}<\/div>/)
  assert.match(source, /操作人编号/)
  assert.match(source, /追踪编号/)
})
