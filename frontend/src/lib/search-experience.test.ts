import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addSearchHistoryTerm,
  buildEmptySearchRecommendations,
  buildSearchSidebarRecommendations,
  buildSearchSuggestions,
  formatSearchLoadFailure,
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

test('builds suggestions from recent viewed activity title and artist', () => {
  const suggestions = buildSearchSuggestions({
    keyword: '周',
    history: [],
    popular: ['音乐节'],
    resultTerms: [],
    viewSignals: [
      { activityId: '900001', title: '周杰伦北京演唱会', artist: '周杰伦', city: '北京' },
      { activityId: '900002', title: '五月天深圳演唱会', artist: '五月天', city: '深圳' },
    ],
  })

  assert.deepEqual(suggestions, ['周杰伦北京演唱会', '周杰伦'])
})

test('builds empty result recommendations from real activity candidates and nearby cities', () => {
  const recommendations = buildEmptySearchRecommendations({
    keyword: '周',
    activeCity: '北京',
    activities: [
      { title: '周杰伦上海站', venue: '上海' },
      { title: '音乐节', venue: '北京' },
    ],
    cities: ['北京', '上海', '广州', '深圳'],
  })

  assert.deepEqual(recommendations.terms, ['周杰伦上海站'])
  assert.deepEqual(recommendations.recentTerms, [])
  assert.deepEqual(recommendations.cities, ['上海', '广州', '深圳'])
})

test('builds empty result recommendations from recent viewed activities when keyword has no matches', () => {
  const recommendations = buildEmptySearchRecommendations({
    keyword: '冷门关键词',
    activeCity: '北京',
    activities: [{ title: '音乐节', venue: '北京' }],
    viewSignals: [
      { activityId: '900001', title: '周杰伦北京演唱会', category: '演唱会', city: '北京' },
      { activityId: '900002', title: '周杰伦北京演唱会', category: '演唱会', city: '北京' },
      { activityId: '900003', title: '上海话剧周末场', category: '话剧', city: '上海' },
    ],
    cities: ['北京', '上海', '广州'],
  })

  assert.deepEqual(recommendations.terms, [])
  assert.deepEqual(recommendations.recentTerms, ['周杰伦北京演唱会', '上海话剧周末场'])
})

test('builds sidebar recommendations from recent view signals before raw result order', () => {
  const recommendations = buildSearchSidebarRecommendations({
    activities: [
      { id: '10', title: '上海亲子剧', categoryId: '儿童亲子', venue: '上海', poster: '/kids.jpg', priceRange: '¥180起' },
      { id: '11', title: '周杰伦北京演唱会', categoryId: '演唱会', venue: '北京', poster: '/jay.jpg', priceRange: '¥480起' },
      { id: '12', title: '五月天深圳演唱会', categoryId: '演唱会', venue: '深圳', poster: '/mayday.jpg', priceRange: '¥380起' },
    ],
    viewSignals: [{ activityId: '1', category: '演唱会', artist: '周杰伦', city: '北京' }],
  })

  assert.deepEqual(recommendations.map(item => item.id), ['11', '12', '10'])
})

test('does not show viewed activities or fake sidebar recommendations without candidates', () => {
  assert.deepEqual(buildSearchSidebarRecommendations({ activities: [], viewSignals: [{ activityId: '1', category: '演唱会' }] }), [])
  assert.deepEqual(
    buildSearchSidebarRecommendations({
      activities: [
        { id: '1', title: '已浏览演出', categoryId: '演唱会', venue: '北京', poster: '/seen.jpg', priceRange: '¥480起' },
        { id: '2', title: '同类演出', categoryId: '演唱会', venue: '北京', poster: '/next.jpg', priceRange: '¥380起' },
      ],
      viewSignals: [{ activityId: '1', category: '演唱会', city: '北京' }],
    }).map(item => item.id),
    ['2'],
  )
})

test('formats real search load failure without mock fallback', () => {
  assert.deepEqual(formatSearchLoadFailure(new Error('搜索服务暂时不可用，请稍后重试')), {
    title: '搜索暂时不可用',
    description: '搜索服务暂时不可用，请稍后重试',
    retryLabel: '重新搜索',
  })
})
