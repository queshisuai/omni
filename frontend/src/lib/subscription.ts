import type { ActivityViewSignal } from './personalized-recommendations.ts'

export type SubscriptionTargetType =
  | 'ACTIVITY_WANT'
  | 'SALE_REMINDER'
  | 'WAITLIST_REMINDER'
  | 'TOUR_CITY_REMINDER'
  | 'ARTIST_FOLLOW'
  | 'CITY_FOLLOW'
  | string

const TARGET_TYPE_LABELS: Record<string, string> = {
  ACTIVITY_WANT: '想看',
  SALE_REMINDER: '开售提醒',
  WAITLIST_REMINDER: '候补通知',
  TOUR_CITY_REMINDER: '巡演城市提醒',
  ARTIST_FOLLOW: '艺人关注',
  CITY_FOLLOW: '城市关注',
}

export function formatSubscriptionTargetType(type: SubscriptionTargetType | null | undefined) {
  if (!type) return '订阅'
  return TARGET_TYPE_LABELS[String(type).toUpperCase()] || '订阅'
}

export function getCountdownText(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return '时间待定'
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return '时间待定'
  const diffMs = target - nowMs
  if (diffMs <= 0) return '已开始'
  const totalMinutes = Math.ceil(diffMs / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}天${hours}小时后`
  if (hours > 0) return `${hours}小时${minutes}分钟后`
  return `${minutes}分钟后`
}

export function formatSubscriptionTime(value: string | null | undefined) {
  if (!value) return '时间待定'
  return value.replace('T', ' ').slice(0, 16)
}

export interface SubscriptionEmptyGuide {
  activityId: string
  title: string
  href: string
  actionLabel: string
  poster?: string | null
  meta: string
  artistHint?: string | null
}

export function buildSubscriptionEmptyGuides(signals: ActivityViewSignal[], limit = 3): SubscriptionEmptyGuide[] {
  const seen = new Set<string>()
  const guides: SubscriptionEmptyGuide[] = []

  for (const signal of signals) {
    const activityId = signal.activityId?.trim()
    const title = signal.title?.trim()
    if (!activityId || !title || seen.has(activityId)) continue

    const city = signal.city?.trim()
    const artist = signal.artist?.trim()
    guides.push({
      activityId,
      title,
      href: `/activity/${activityId}`,
      poster: signal.poster || null,
      meta: [city, artist].filter(Boolean).join(' · ') || '活动详情',
      actionLabel: Number(signal.status) === 1 ? '去添加想看' : '开启开售提醒',
      artistHint: artist ? `也可关注${artist}` : null,
    })
    seen.add(activityId)
    if (guides.length >= limit) break
  }

  return guides
}
