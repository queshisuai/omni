import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('homepage does not fall back to mock categories sections or banners', () => {
  const content = source('../app/page.tsx')

  assert.doesNotMatch(content, /@\/lib\/mock-data/)
  assert.doesNotMatch(content, /\bmockCategories\b/)
  assert.doesNotMatch(content, /\bmockSections\b/)
  assert.doesNotMatch(content, /降级到 mock 数据/)
})

test('homepage banner uses dedicated wide banner posters instead of activity covers', () => {
  const content = source('../app/page.tsx')

  assert.doesNotMatch(content, /imageUrl:\s*activity\.poster/)
  assert.match(content, /\/images\/banners\/home-[a-z-]+\.jpg/)
})

test('homepage shared footer does not import mock data', () => {
  const content = source('../components/Footer.tsx')

  assert.doesNotMatch(content, /@\/lib\/mock-data/)
})

test('frontend mock data module is not kept as a production fallback source', () => {
  assert.equal(existsSync(new URL('./mock-data.ts', import.meta.url)), false)
})
