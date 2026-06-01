export const ACTIVITY_VIEW_SIGNAL_KEY = 'omni_activity_view_signals'

export interface ActivityViewSignal {
  activityId: string
  category?: string | null
  artist?: string | null
  city?: string | null
  title?: string | null
  poster?: string | null
  viewedAt?: string | null
}

export interface RecommendationActivity {
  id: string
  title: string
  categoryId: string
  venue: string
}

export function parseActivityViewSignals(raw: string | null | undefined): ActivityViewSignal[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is ActivityViewSignal => item && typeof item.activityId === 'string')
      .slice(0, 20)
  } catch {
    return []
  }
}

export function addActivityViewSignal(history: ActivityViewSignal[], signal: ActivityViewSignal, limit = 20) {
  if (!signal.activityId) return history.slice(0, limit)
  const nextSignal: ActivityViewSignal = {
    ...signal,
    viewedAt: signal.viewedAt || new Date().toISOString(),
  }
  const next = [nextSignal, ...history.filter(item => item.activityId !== signal.activityId)]
  return next.slice(0, limit)
}

export function buildPersonalizedActivities<T extends RecommendationActivity>(activities: T[], signals: ActivityViewSignal[], limit = 8) {
  if (signals.length === 0) return []
  const viewed = new Set(signals.map(item => item.activityId))
  return activities
    .filter(item => !viewed.has(item.id))
    .map(item => ({ item, score: scoreActivity(item, signals) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(row => row.item)
}

function scoreActivity(activity: RecommendationActivity, signals: ActivityViewSignal[]) {
  let score = 0
  for (const signal of signals) {
    if (signal.category && activity.categoryId === signal.category) score += 4
    if (signal.artist && activity.title.includes(signal.artist)) score += 3
    if (signal.city && activity.venue.includes(signal.city)) score += 2
  }
  return score
}
