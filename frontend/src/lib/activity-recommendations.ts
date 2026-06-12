import type { ActivityViewSignal } from './personalized-recommendations'

const RECOMMENDABLE_STATUSES = new Set([1, 2])

export interface ActivityRecommendationCandidate {
  id: number | string
  itemType?: string | null
  name: string
  poster?: string | null
  categoryName?: string | null
  artistName?: string | null
  venueCity?: string | null
  startTime?: string | null
  minPrice?: number | null
  status?: number | null
}

export interface ActivityRecommendationContext {
  activityId: number | string
  categoryName?: string | null
  artistName?: string | null
  city?: string | null
  startTime?: string | null
  minPrice?: number | null
  viewSignals?: ActivityViewSignal[]
}

export interface ActivityDetailRecommendation {
  id: string
  itemType: string
  title: string
  poster: string
  categoryName: string
  artistName: string
  city: string
  time: string
  price: number | null
  score: number
  reason: string
  href: string
}

interface ScoredRecommendation {
  item: ActivityDetailRecommendation
  categoryMatched: boolean
  cityMatched: boolean
  artistMatched: boolean
}

export function buildActivityDetailRecommendations(
  candidates: ActivityRecommendationCandidate[],
  context: ActivityRecommendationContext,
  limit = 3,
): ActivityDetailRecommendation[] {
  const currentId = String(context.activityId)
  const deduped = dedupeCandidates(candidates)
  const scored = deduped
    .filter(candidate => isRecommendableCandidate(candidate, currentId))
    .map(candidate => scoreCandidate(candidate, context))
    .filter(row => row.item.score > 0)
    .sort((a, b) => b.item.score - a.item.score || a.item.time.localeCompare(b.item.time, 'zh-CN') || a.item.title.localeCompare(b.item.title, 'zh-CN'))

  return diversify(scored, limit).map(row => row.item)
}

function dedupeCandidates(candidates: ActivityRecommendationCandidate[]) {
  const map = new Map<string, ActivityRecommendationCandidate>()
  for (const candidate of candidates) {
    const id = String(candidate.id)
    if (!map.has(id)) map.set(id, candidate)
  }
  return Array.from(map.values())
}

function isRecommendableCandidate(candidate: ActivityRecommendationCandidate, currentId: string) {
  if (!candidate.name?.trim()) return false
  if (String(candidate.id) === currentId) return false
  if (candidate.status != null && !RECOMMENDABLE_STATUSES.has(candidate.status)) return false
  return true
}

function scoreCandidate(candidate: ActivityRecommendationCandidate, context: ActivityRecommendationContext): ScoredRecommendation {
  const candidateCategory = normalize(candidate.categoryName)
  const contextCategory = normalize(context.categoryName)
  const candidateCity = normalize(candidate.venueCity)
  const contextCity = normalize(context.city)
  const candidateArtist = normalize(candidate.artistName)
  const contextArtist = normalize(context.artistName)
  const candidateTitle = normalize(candidate.name)

  let score = 0
  const categoryMatched = Boolean(contextCategory && candidateCategory === contextCategory)
  const cityMatched = Boolean(contextCity && candidateCity.includes(contextCity))
  const artistMatched = isArtistMatched(candidateArtist, candidateTitle, contextArtist)

  if (categoryMatched) score += 40
  if (cityMatched) score += 25
  if (artistMatched) score += 30
  score += scoreTimeDistance(candidate.startTime, context.startTime)
  score += scorePriceDistance(candidate.minPrice, context.minPrice)
  score += scoreViewSignals(candidate, context.viewSignals || [])
  if (candidate.status === 1) score += 6
  if (candidate.status === 2) score += 3

  const id = String(candidate.id)
  return {
    item: {
      id,
      itemType: candidate.itemType || 'activity',
      title: candidate.name,
      poster: candidate.poster || '/background.png',
      categoryName: candidate.categoryName || '',
      artistName: candidate.artistName || '',
      city: candidate.venueCity || '待定',
      time: formatActivityDate(candidate.startTime),
      price: candidate.minPrice ?? null,
      score,
      reason: buildReason({ categoryMatched, cityMatched, artistMatched }),
      href: candidate.itemType === 'tour' ? `/tour/${id}` : `/activity/${id}`,
    },
    categoryMatched,
    cityMatched,
    artistMatched,
  }
}

function diversify(scored: ScoredRecommendation[], limit: number) {
  const selected: ScoredRecommendation[] = []
  const remaining = [...scored]

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0
    let bestScore = Number.NEGATIVE_INFINITY

    for (let index = 0; index < remaining.length; index += 1) {
      const row = remaining[index]
      const adjustedScore = row.item.score - diversityPenalty(row.item, selected.map(item => item.item))
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore
        bestIndex = index
      }
    }

    const [next] = remaining.splice(bestIndex, 1)
    selected.push(next)
  }

  return selected
}

function diversityPenalty(candidate: ActivityDetailRecommendation, selected: ActivityDetailRecommendation[]) {
  let penalty = 0
  for (const item of selected) {
    if (candidate.artistName && candidate.artistName === item.artistName) penalty += 45
    if (candidate.city && candidate.city === item.city) penalty += 18
    if (candidate.categoryName && candidate.categoryName === item.categoryName) penalty += 8
  }
  return penalty
}

function scoreViewSignals(candidate: ActivityRecommendationCandidate, signals: ActivityViewSignal[]) {
  let score = 0
  for (const signal of signals.slice(0, 8)) {
    if (signal.category && candidate.categoryName === signal.category) score += 4
    if (signal.city && candidate.venueCity?.includes(signal.city)) score += 3
    if (signal.artist && isArtistMatched(normalize(candidate.artistName), normalize(candidate.name), normalize(signal.artist))) score += 5
  }
  return score
}

function isArtistMatched(candidateArtist: string, candidateTitle: string, contextArtist: string) {
  if (!contextArtist) return false
  if (candidateArtist && candidateArtist === contextArtist) return true
  if (contextArtist.length >= 2 && candidateTitle.includes(contextArtist)) return true
  return false
}

function scoreTimeDistance(candidateStartTime?: string | null, contextStartTime?: string | null) {
  const candidateTime = parseDate(candidateStartTime)
  const contextTime = parseDate(contextStartTime)
  if (!candidateTime || !contextTime) return 0
  const days = Math.abs(candidateTime.getTime() - contextTime.getTime()) / 86400000
  if (days <= 30) return 8
  if (days <= 90) return 4
  return 0
}

function scorePriceDistance(candidatePrice?: number | null, contextPrice?: number | null) {
  if (!candidatePrice || !contextPrice) return 0
  const diffRatio = Math.abs(candidatePrice - contextPrice) / Math.max(candidatePrice, contextPrice)
  if (diffRatio <= 0.2) return 8
  if (diffRatio <= 0.5) return 4
  return 0
}

function buildReason(matches: { categoryMatched: boolean; cityMatched: boolean; artistMatched: boolean }) {
  const reasons = [
    matches.categoryMatched ? '同类目' : '',
    matches.cityMatched ? '同城市' : '',
    matches.artistMatched ? '同艺人' : '',
  ].filter(Boolean)
  return reasons.length > 0 ? reasons.join(' · ') : '近期热门'
}

function formatActivityDate(value?: string | null) {
  if (!value) return '时间待定'
  return value.slice(0, 10)
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() || ''
}
