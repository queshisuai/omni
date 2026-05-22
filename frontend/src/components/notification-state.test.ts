import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterVisibleNotifications, getLatestNotificationTime, getReadNotificationIds, isNotificationUnread } from './notification-state.ts'
import type { NotificationVO } from '@/types/api'

function notification(id: number, createTime: string): NotificationVO {
  return { id, userId: 2004, type: 'IN_APP', content: '测试消息', status: 1, createTime }
}

test('filters notifications hidden by local ids', () => {
  const items = [notification(1, '2026-05-22T10:00:00'), notification(2, '2026-05-22T11:00:00')]

  assert.deepEqual(filterVisibleNotifications(items, [1]).map((item) => item.id), [2])
})

test('read state is based on latest local read timestamp', () => {
  const readAt = new Date('2026-05-22T10:30:00').getTime()

  assert.equal(isNotificationUnread(notification(1, '2026-05-22T10:00:00'), readAt), false)
  assert.equal(isNotificationUnread(notification(2, '2026-05-22T11:00:00'), readAt), true)
})

test('collects read ids for local-only deletion', () => {
  const readAt = new Date('2026-05-22T10:30:00').getTime()
  const items = [notification(1, '2026-05-22T10:00:00'), notification(2, '2026-05-22T11:00:00')]

  assert.deepEqual(getReadNotificationIds(items, readAt), [1])
})

test('finds latest notification timestamp for mark all read', () => {
  const items = [notification(1, '2026-05-22T10:00:00'), notification(2, '2026-05-22T11:00:00')]

  assert.equal(getLatestNotificationTime(items), new Date('2026-05-22T11:00:00').getTime())
})
