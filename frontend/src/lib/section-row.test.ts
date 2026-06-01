import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSectionItemKey } from './section-row.ts'

test('builds unique keys for activity and tour rows that share a numeric id', () => {
  const keys = [
    buildSectionItemKey('popular', { id: '5', itemType: 'activity' }, 0),
    buildSectionItemKey('popular', { id: '5', itemType: 'tour' }, 1),
    buildSectionItemKey('popular', { id: '5', itemType: 'activity' }, 2),
  ]

  assert.deepEqual(new Set(keys).size, keys.length)
})
