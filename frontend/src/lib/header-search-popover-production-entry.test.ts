import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('header search uses dynamic history and trending popover instead of hardcoded popular copy', () => {
  const header = source('components/Header.tsx')
  const api = source('lib/api.ts')
  const types = source('types/api.ts')

  assert.match(header, /搜索演出、艺人、场馆\.\.\./)
  assert.match(header, /历史搜索/)
  assert.match(header, /暂无历史搜索记录/)
  assert.match(header, /清空/)
  assert.match(header, /热门榜单/)
  assert.match(header, /实时热度更新/)
  assert.match(header, /相关推荐/)
  assert.match(header, /搜索 "/)
  assert.match(header, /相关结果/)
  assert.match(header, /renderHighlightedText/)
  assert.match(header, /renderHighlightedText\(item\.name, activeSearchKeyword\)/)
  assert.match(header, /renderHighlightedText\(meta, activeSearchKeyword\)/)
  assert.match(header, /listActivities/)
  assert.match(header, /setSuggestionItems/)
  assert.match(header, /Enter\s*↵/)
  assert.match(header, /shrink-0 whitespace-nowrap rounded-md border/)
  assert.match(header, /getSearchHistory/)
  assert.match(header, /addSearchHistory/)
  assert.match(header, /clearSearchHistory/)
  assert.match(header, /getSearchTrending/)
  assert.match(header, /search_history_records/)
  assert.match(header, /Escape/)
  assert.match(header, /mousedown|pointerdown/)
  assert.match(header, /tagType/)
  assert.match(header, /targetType/)
  assert.doesNotMatch(header, /模糊搜索/)
  assert.doesNotMatch(header, /搜索关键词/)
  assert.doesNotMatch(header, /border border-\[#FFD6E4\] bg-\[#FFF0F5\]/)
  assert.doesNotMatch(header, /搜索明星、演出、体育赛事/)
  assert.doesNotMatch(header, /DEFAULT_POPULAR_SEARCHES/)

  assert.match(api, /getSearchHistory/)
  assert.match(api, /addSearchHistory/)
  assert.match(api, /clearSearchHistory/)
  assert.match(api, /getSearchTrending/)
  assert.match(api, /\/api\/v1\/search\/history/)
  assert.match(api, /\/api\/v1\/search\/trending/)
  assert.match(types, /SearchTrendingItem/)
  assert.match(types, /SearchTrendingTagType/)
})
