import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterVisibleNotifications, getLatestNotificationTime, getNotificationAction, getNotificationContentSegments, getNotificationTypeMeta, getReadNotificationIds, isNotificationUnread, shouldRenderNotificationActionButton } from './notification-state.ts'
import type { NotificationVO } from '@/types/api'

function notification(id: number, createTime: string): NotificationVO {
  return { id, userId: 2004, type: 'IN_APP', content: '测试消息', status: 1, createTime }
}

test('read state is based on backend read time', () => {
  assert.equal(isNotificationUnread({ ...notification(1, '2026-05-22T10:00:00'), readTime: '2026-05-22T10:30:00' }), false)
  assert.equal(isNotificationUnread({ ...notification(2, '2026-05-22T11:00:00'), readTime: null }), true)
})

test('collects read ids from backend read time for deletion', () => {
  const items = [
    { ...notification(1, '2026-05-22T10:00:00'), readTime: '2026-05-22T10:30:00' },
    { ...notification(2, '2026-05-22T11:00:00'), readTime: null },
  ]

  assert.deepEqual(getReadNotificationIds(items), [1])
})

test('filters backend deleted notifications without local hidden ids', () => {
  const items = [
    notification(1, '2026-05-22T10:00:00'),
    { ...notification(2, '2026-05-22T11:00:00'), deletedTime: '2026-05-22T12:00:00' },
  ]

  assert.deepEqual(filterVisibleNotifications(items).map((item) => item.id), [1])
})

test('uses backend action metadata before local type fallback', () => {
  assert.deepEqual(getNotificationAction({
    ...notification(14, '2026-06-02T10:00:00'),
    type: 'SUPPORT_REPLY',
    actionHref: '/help?conversationId=99',
    actionLabel: '查看客服会话',
  }), {
    href: '/help?conversationId=99',
    buttonLabel: '查看客服会话',
  })
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

test('classifies new event notifications by business scenario', () => {
  assert.equal(getNotificationTypeMeta({ ...notification(140, '2026-06-07T10:00:00'), type: 'GRAB_SUCCESS' }).label, '抢票通知')
  assert.equal(getNotificationTypeMeta({ ...notification(141, '2026-06-07T10:00:00'), type: 'GRAB_FAILED' }).label, '抢票通知')
  assert.equal(getNotificationTypeMeta({ ...notification(142, '2026-06-07T10:00:00'), type: 'WAITLIST_MATCHED' }).label, '候补通知')
  assert.equal(getNotificationTypeMeta({ ...notification(143, '2026-06-07T10:00:00'), type: 'ORDER_PAYMENT_TIMEOUT' }).label, '订单提醒')
  assert.equal(getNotificationTypeMeta({ ...notification(149, '2026-06-07T10:00:00'), type: 'ACTIVITY_BUYER_NOTICE' }).label, '活动通知')
  assert.equal(getNotificationTypeMeta({ ...notification(144, '2026-06-07T10:00:00'), type: 'ACTIVITY_RESCHEDULED' }).label, '活动变更')
  assert.equal(getNotificationTypeMeta({ ...notification(145, '2026-06-07T10:00:00'), type: 'ACTIVITY_CANCELLED' }).label, '活动变更')
  assert.equal(getNotificationTypeMeta({ ...notification(146, '2026-06-07T10:00:00'), type: 'REFUND_APPROVED' }).label, '退款通知')
  assert.equal(getNotificationTypeMeta({ ...notification(147, '2026-06-07T10:00:00'), type: 'REFUND_FAILED' }).label, '退款通知')
})

test('does not label unknown notification types as generic in-app messages', () => {
  assert.deepEqual(getNotificationTypeMeta({ ...notification(148, '2026-06-07T10:00:00'), type: 'FUTURE_EVENT' }), {
    key: 'FUTURE_EVENT',
    label: '未知消息',
    color: '#64748b',
    bg: '#f8fafc',
  })
})

test('links new event notifications to user-visible order or waitlist entries', () => {
  assert.deepEqual(getNotificationAction({ ...notification(150, '2026-06-07T10:00:00'), type: 'GRAB_SUCCESS', orderId: 9002 }), {
    href: '/orders/9002',
    buttonLabel: '查看抢票订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(151, '2026-06-07T10:00:00'), type: 'GRAB_FAILED' }), {
    href: '/orders',
    buttonLabel: '查看订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(152, '2026-06-07T10:00:00'), type: 'WAITLIST_MATCHED', orderId: 9003 }), {
    href: '/orders/9003',
    buttonLabel: '处理候补订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(153, '2026-06-07T10:00:00'), type: 'ORDER_PAYMENT_TIMEOUT', orderId: 9004 }), {
    href: '/orders/9004',
    buttonLabel: '查看待支付订单',
  })
  assert.deepEqual(getNotificationAction({ ...notification(154, '2026-06-07T10:00:00'), type: 'ACTIVITY_RESCHEDULED', orderId: 9005 }), {
    href: '/orders/9005',
    buttonLabel: '查看相关订单',
  })
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

test('links refund notifications to the concrete order detail', () => {
  assert.deepEqual(getNotificationAction({ ...notification(15, '2026-06-07T10:00:00'), type: 'REFUND_APPROVED', orderId: 980057 }), {
    href: '/orders/980057',
    buttonLabel: '查看退款进度',
  })
  assert.deepEqual(getNotificationAction({ ...notification(16, '2026-06-07T10:00:00'), type: 'REFUND_FAILED' }), {
    href: '/orders',
    buttonLabel: '查看退款订单',
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
    href: '/notifications',
    buttonLabel: '查看待办',
  })
  assert.equal(getNotificationAction({ ...notification(111, '2026-05-22T12:00:00'), type: 'TODO' }, 'admin', ['risk.review'])?.href, '/console/risk-resolutions')
  assert.deepEqual(getNotificationAction({ ...notification(12, '2026-05-22T12:00:00'), type: 'TODO' }, 'organizer'), {
    href: '/console/risk-events',
    buttonLabel: '查看待办',
  })
})
