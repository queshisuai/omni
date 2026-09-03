import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPaginationItems, normalizePageRequest } from './pagination.ts'

test('normalizes manual page jump input into the available page range', () => {
  assert.equal(normalizePageRequest('3', 8), 3)
  assert.equal(normalizePageRequest('99', 8), 8)
  assert.equal(normalizePageRequest('0', 8), 1)
  assert.equal(normalizePageRequest('abc', 8), 1)
  assert.equal(normalizePageRequest('', 8), 1)
})

test('keeps pagination valid when there are no records', () => {
  assert.equal(normalizePageRequest('5', 0), 1)
})

test('builds compact pagination items with jump slots for page gaps', () => {
  assert.deepEqual(buildPaginationItems(5, 10), [1, 'jump-prev', 3, 4, 5, 6, 7, 'jump-next', 10])
  assert.deepEqual(buildPaginationItems(1, 4), [1, 2, 3, 4])
})
