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

test('audit log filters use Chinese select options for action and target type', () => {
  assert.match(source, /getOperationActionFilterOptions/)
  assert.match(source, /getOperationTargetTypeFilterOptions/)
  assert.match(source, /全部操作类型/)
  assert.match(source, /全部对象类型/)
  assert.match(source, /value=\{option\.value\}/)
  assert.match(source, /\{option\.label\}/)
  assert.doesNotMatch(source, /placeholder="动作"/)
  assert.doesNotMatch(source, /placeholder="对象类型"/)
})
