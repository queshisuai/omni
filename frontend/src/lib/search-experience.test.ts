import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addSearchHistoryTerm,
  buildSearchSuggestions,
  parseSearchHistory,
} from './search-experience.ts'

test('adds search history with newest first and no duplicates', () => {
  const history = addSearchHistoryTerm(['演唱会', '话剧'], ' 演唱会 ')

  assert.deepEqual(history, ['演唱会', '话剧'])
  assert.deepEqual(addSearchHistoryTerm(history, '音乐节'), ['音乐节', '演唱会', '话剧'])
})

test('parse search history ignores invalid payloads', () => {
  assert.deepEqual(parseSearchHistory('["演唱会","音乐节"]'), ['演唱会', '音乐节'])
  assert.deepEqual(parseSearchHistory('{"bad":true}'), [])
  assert.deepEqual(parseSearchHistory(''), [])
})

test('builds suggestions from history popular terms and live results', () => {
  const suggestions = buildSearchSuggestions({
    keyword: '周',
    history: ['周杰伦', '脱口秀'],
    popular: ['周末演出', '亲子剧'],
    resultTerms: ['周杰伦演唱会', '上海梅赛德斯'],
  })

  assert.deepEqual(suggestions.slice(0, 3), ['周杰伦', '周末演出', '周杰伦演唱会'])
})
