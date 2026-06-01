import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterVisibleNotifications, getLatestNotificationTime, getNotificationAction, getNotificationContentSegments, getNotificationTypeMeta, getReadNotificationIds, isNotificationUnread, shouldRenderNotificationActionButton } from './notification-state.ts'
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

test('classifies waitlist notifications as message-center waitlist alerts', () => {
  assert.deepEqual(getNotificationTypeMeta({ ...notification(3, '2026-05-22T12:00:00'), type: 'WAITLIST_OFFERED' }), {
    key: 'WAITLIST_OFFERED',
    label: '候补通知',
    color: '#ff1268',
    bg: '#fff0f5',
  })
  assert.equal(getNotificationTypeMeta({ ...notification(4, '2026-05-22T12:00:00'), type: 'WAITLIST_EXPIRED' }).label, '候补通知')
  assert.equal(getNotificationTypeMeta({ ...notification(5, '2026-05-22T12:00:00'), type: 'WAITLIST_PAID' }).label, '候补通知')
})

test('links waitlist notifications to the related order without exposing service source', () => {
  assert.deepEqual(getNotificationAction({ ...notification(6, '2026-05-22T12:00:00'), type: 'WAITLIST_OFFERED', orderId: 9001 }), {
    href: '/orders/9001',
    buttonLabel: '处理候补订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(7, '2026-05-22T12:00:00'), type: 'WAITLIST_EXPIRED' }), {
    href: '/waitlist',
    buttonLabel: '查看候补',
  })
})

test('links team and generic order notifications to order service pages', () => {
  assert.deepEqual(getNotificationAction({ ...notification(8, '2026-05-22T12:00:00'), type: 'TEAM_LOCKED', orderId: 8001 }), {
    href: '/orders/8001',
    buttonLabel: '查看小队订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(9, '2026-05-22T12:00:00'), type: 'SMS', orderId: 7001 }), {
    href: '/orders/7001',
    buttonLabel: '查看相关订单',
  })
})

test('links support messages for normal users to help center', () => {
  assert.deepEqual(getNotificationAction({ ...notification(10, '2026-05-22T12:00:00'), type: 'SUPPORT_REPLY' }), {
    href: '/help',
    buttonLabel: '查看客服会话',
  })
  assert.deepEqual(getNotificationAction({ ...notification(1010, '2026-05-22T12:00:00'), type: 'SUPPORT_REPLY' }, 'admin'), {
    href: '/help',
    buttonLabel: '查看客服会话',
  })
})

test('detects legacy in-app support reply content as a support message', () => {
  const legacy = {
    ...notification(13, '2026-06-01T15:18:00'),
    type: 'IN_APP',
    content: '人工客服回复了你的咨询，请查看客服会话。',
  }

  assert.equal(getNotificationTypeMeta(legacy).label, '客服消息')
  assert.deepEqual(getNotificationAction(legacy), {
    href: '/help',
    buttonLabel: '查看客服会话',
  })
  assert.deepEqual(getNotificationContentSegments(legacy.content, getNotificationAction(legacy)), [
    { text: '人工客服回复了你的咨询，请' },
    { text: '查看客服会话', href: '/help' },
    { text: '。' },
  ])
})

test('turns matching notification content text into an inline action segment', () => {
  assert.deepEqual(
    getNotificationContentSegments('人工客服回复了你的咨询，请查看客服会话。', {
      href: '/help',
      buttonLabel: '查看客服会话',
    }),
    [
      { text: '人工客服回复了你的咨询，请' },
      { text: '查看客服会话', href: '/help' },
      { text: '。' },
    ],
  )
  assert.equal(
    shouldRenderNotificationActionButton('人工客服回复了你的咨询，请查看客服会话。', {
      href: '/help',
      buttonLabel: '查看客服会话',
    }),
    false,
  )
  assert.equal(
    shouldRenderNotificationActionButton('人工客服有新的回复。', {
      href: '/help',
      buttonLabel: '查看客服会话',
    }),
    true,
  )
})

test('links risk messages to their service workbenches', () => {
  assert.deepEqual(getNotificationAction({ ...notification(11, '2026-05-22T12:00:00'), type: 'TODO' }, 'admin'), {
    href: '/console/risk-resolutions',
    buttonLabel: '查看待办',
  })
  assert.deepEqual(getNotificationAction({ ...notification(12, '2026-05-22T12:00:00'), type: 'TODO' }, 'organizer'), {
    href: '/console/risk-events',
    buttonLabel: '查看待办',
  })
})
