import type { ActivityViewSignal } from './personalized-recommendations'

export const SEARCH_HISTORY_KEY = 'search_history_records'
export const LEGACY_SEARCH_HISTORY_KEY = 'omni_search_history'

export const DEFAULT_POPULAR_SEARCHES = ['演唱会', '音乐节', '话剧', '脱口秀', '周末演出', '亲子剧']

export function parseSearchHistory(raw: string | null | undefined) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 10)
  } catch {
    return []
  }
}

export function addSearchHistoryTerm(history: string[], term: string, limit = 10) {
  const keyword = term.trim()
  if (!keyword) return history.slice(0, limit)
  const next = [keyword, ...history.filter(item => item !== keyword)]
  return next.slice(0, limit)
}

export function readSearchHistoryFromStorage(storage: Pick<Storage, 'getItem'>) {
  const current = parseSearchHistory(storage.getItem(SEARCH_HISTORY_KEY))
  if (current.length > 0) return current
  return parseSearchHistory(storage.getItem(LEGACY_SEARCH_HISTORY_KEY))
}

export function writeSearchHistoryToStorage(storage: Pick<Storage, 'setItem'>, history: string[]) {
  storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 10)))
}

export function getSearchTrendingTagMeta(tagType?: string | null) {
  const normalized = String(tagType || 'NONE').toUpperCase()
  if (normalized === 'BURST') return { label: '爆', className: 'bg-[#FFF0F5] text-[#E6005C]' }
  if (normalized === 'HOT') return { label: '热', className: 'bg-orange-50 text-orange-500' }
  if (normalized === 'NEW') return { label: '新', className: 'bg-blue-50 text-blue-500' }
  return { label: '', className: '' }
}

export function formatSearchLoadFailure(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : ''
  return {
    title: '搜索暂时不可用',
    description: message || '搜索服务暂时不可用，请稍后重试',
    retryLabel: '重新搜索',
  }
}

export function shouldRenderSearchSuggestionStrip(input: {
  pathname: string
  keyword: string
  suggestionCount: number
}) {
  return input.pathname === '/search'
    && input.keyword.trim().length > 0
    && input.suggestionCount > 0
}

export function buildSearchSuggestions(input: {
  keyword: string
  history: string[]
  popular?: string[]
  resultTerms?: string[]
  viewSignals?: ActivityViewSignal[]
  limit?: number
}) {
  const keyword = input.keyword.trim()
  const source = [
    ...input.history,
    ...buildViewSignalSuggestionTerms(input.viewSignals || []),
    ...(input.popular || DEFAULT_POPULAR_SEARCHES),
    ...(input.resultTerms || []),
  ]
  const seen = new Set<string>()
  const suggestions: string[] = []
  for (const item of source) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    if (!keyword || text.includes(keyword)) {
      seen.add(text)
      suggestions.push(text)
    }
    if (suggestions.length >= (input.limit || 8)) break
  }
  return suggestions
}

function buildViewSignalSuggestionTerms(signals: ActivityViewSignal[]) {
  const terms: string[] = []
  const seen = new Set<string>()
  for (const signal of signals.slice(0, 8)) {
    for (const value of [signal.title, signal.artist]) {
      const term = value?.trim()
      if (!term || seen.has(term)) continue
      seen.add(term)
      terms.push(term)
    }
  }
  return terms
}

export function buildEmptySearchRecommendations(input: {
  keyword: string
  activeCity: string
  activities: Array<{ title?: string | null; venue?: string | null }>
  viewSignals?: ActivityViewSignal[]
  cities: string[]
  limit?: number
}) {
  const keyword = input.keyword.trim().toLowerCase()
  const limit = input.limit || 6
  const seenTerms = new Set<string>()
  const terms: string[] = []

  for (const activity of input.activities) {
    const title = activity.title?.trim()
    if (!title || seenTerms.has(title)) continue
    if (!keyword || title.toLowerCase().includes(keyword)) {
      seenTerms.add(title)
      terms.push(title)
    }
    if (terms.length >= limit) break
  }

  const recentTerms = buildRecentViewTerms(input.viewSignals || [], terms, Math.min(4, limit))

  const activeCity = input.activeCity.trim()
  const cities = input.cities
    .map(city => city.trim())
    .filter(city => city && city !== '全部' && city !== activeCity)
    .filter((city, index, all) => all.indexOf(city) === index)
    .slice(0, 4)

  return { terms, recentTerms, cities }
}

function buildRecentViewTerms(signals: ActivityViewSignal[], existingTerms: string[], limit: number) {
  const seen = new Set(existingTerms)
  const terms: string[] = []
  for (const signal of signals) {
    const title = signal.title?.trim()
    if (!title || seen.has(title)) continue
    seen.add(title)
    terms.push(title)
    if (terms.length >= limit) break
  }
  return terms
}

export interface SearchSidebarActivity {
  id: string
  itemType?: string | null
  title: string
  categoryId: string
  venue: string
  poster: string
  priceRange: string
}

export function buildSearchSidebarRecommendations<T extends SearchSidebarActivity>(input: {
  activities: T[]
  viewSignals: ActivityViewSignal[]
  limit?: number
}) {
  const limit = input.limit || 4
  if (limit <= 0) return []

  const viewed = new Set(input.viewSignals.map(signal => signal.activityId))
  const candidates = dedupeSidebarActivities(input.activities)
    .filter(activity => activity.title.trim())
    .filter(activity => !viewed.has(activity.id))

  const scored = candidates
    .map((activity, index) => ({
      activity,
      index,
      score: scoreSearchSidebarActivity(activity, input.viewSignals),
    }))

  const personalized = scored
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(row => row.activity)
  const personalizedIds = new Set(personalized.map(activity => activity.id))
  const fallback = candidates.filter(activity => !personalizedIds.has(activity.id))

  return [...personalized, ...fallback].slice(0, limit)
}

function dedupeSidebarActivities<T extends SearchSidebarActivity>(activities: T[]) {
  const seen = new Set<string>()
  const result: T[] = []
  for (const activity of activities) {
    if (seen.has(activity.id)) continue
    seen.add(activity.id)
    result.push(activity)
  }
  return result
}

function scoreSearchSidebarActivity(activity: SearchSidebarActivity, signals: ActivityViewSignal[]) {
  let score = 0
  for (const signal of signals.slice(0, 8)) {
    if (signal.category && activity.categoryId === signal.category) score += 4
    if (signal.artist && activity.title.includes(signal.artist)) score += 3
    if (signal.city && activity.venue.includes(signal.city)) score += 2
  }
  return score
}
