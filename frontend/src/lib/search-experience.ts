export const SEARCH_HISTORY_KEY = 'omni_search_history'

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

export function buildSearchSuggestions(input: {
  keyword: string
  history: string[]
  popular?: string[]
  resultTerms?: string[]
  limit?: number
}) {
  const keyword = input.keyword.trim()
  const source = [
    ...input.history,
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
