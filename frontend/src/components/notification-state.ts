import type { NotificationVO } from '@/types/api'

export const NOTIFICATION_READ_STORAGE_KEY = 'damai-notifications-read-at'
export const NOTIFICATION_HIDDEN_STORAGE_KEY = 'damai-notifications-hidden-ids'

type HiddenMap = Record<string, number[]>

function readJsonMap<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJsonMap<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage can be unavailable in private mode; ignore UI-only state failures.
  }
}

export function getNotificationReadAt(userId: number): number {
  const map = readJsonMap<Record<string, number>>(NOTIFICATION_READ_STORAGE_KEY, {})
  return map[String(userId)] || 0
}

export function setNotificationReadAt(userId: number, value: number) {
  const map = readJsonMap<Record<string, number>>(NOTIFICATION_READ_STORAGE_KEY, {})
  map[String(userId)] = value
  writeJsonMap(NOTIFICATION_READ_STORAGE_KEY, map)
}

export function getHiddenNotificationIds(userId: number): number[] {
  const map = readJsonMap<HiddenMap>(NOTIFICATION_HIDDEN_STORAGE_KEY, {})
  return map[String(userId)] || []
}

export function setHiddenNotificationIds(userId: number, ids: number[]) {
  const map = readJsonMap<HiddenMap>(NOTIFICATION_HIDDEN_STORAGE_KEY, {})
  map[String(userId)] = Array.from(new Set(ids)).filter(Number.isFinite)
  writeJsonMap(NOTIFICATION_HIDDEN_STORAGE_KEY, map)
}

export function getNotificationTime(notification: NotificationVO): number {
  if (!notification.createTime) return 0
  const time = new Date(notification.createTime).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function isNotificationUnread(notification: NotificationVO, readAt: number): boolean {
  return getNotificationTime(notification) > readAt
}

export function filterVisibleNotifications(items: NotificationVO[], hiddenIds: number[]): NotificationVO[] {
  const hidden = new Set(hiddenIds)
  return items.filter((item) => !hidden.has(item.id))
}

export function getLatestNotificationTime(items: NotificationVO[]): number {
  return items.reduce((max, item) => Math.max(max, getNotificationTime(item)), 0)
}

export function getReadNotificationIds(items: NotificationVO[], readAt: number): number[] {
  return items.filter((item) => !isNotificationUnread(item, readAt)).map((item) => item.id)
}
