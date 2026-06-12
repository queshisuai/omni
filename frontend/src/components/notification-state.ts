import { canUseConsoleAction } from '../lib/console-auth.ts'
import type { NotificationVO, UserRole } from '@/types/api'

export interface NotificationTypeMeta {
  key: string
  label: string
  color: string
  bg: string
}

export interface NotificationAction {
  href: string
  buttonLabel: string
}

export interface NotificationContentSegment {
  text: string
  href?: string
}

const TYPE_META: Record<string, NotificationTypeMeta> = {
  IN_APP: { key: 'IN_APP', label: '站内消息', color: '#ff1268', bg: '#fff0f5' },
  CAST_CHANGE: { key: 'CAST_CHANGE', label: '阵容变更', color: '#b91c1c', bg: '#fef2f2' },
  RISK_SUSPENDED: { key: 'RISK_SUSPENDED', label: '风险停售', color: '#b91c1c', bg: '#fef2f2' },
  RISK_RESUMED: { key: 'RISK_RESUMED', label: '恢复售票', color: '#16a34a', bg: '#f0fdf4' },
  SMS: { key: 'SMS', label: '短信', color: '#2563eb', bg: '#eff6ff' },
  EMAIL: { key: 'EMAIL', label: '邮件', color: '#2563eb', bg: '#eff6ff' },
  WAITLIST_OFFERED: { key: 'WAITLIST_OFFERED', label: '候补通知', color: '#ff1268', bg: '#fff0f5' },
  WAITLIST_EXPIRED: { key: 'WAITLIST_EXPIRED', label: '候补通知', color: '#ff1268', bg: '#fff0f5' },
  WAITLIST_PAID: { key: 'WAITLIST_PAID', label: '候补通知', color: '#ff1268', bg: '#fff0f5' },
  WAITLIST_MATCHED: { key: 'WAITLIST_MATCHED', label: '候补通知', color: '#ff1268', bg: '#fff0f5' },
  GRAB_SUCCESS: { key: 'GRAB_SUCCESS', label: '抢票通知', color: '#16a34a', bg: '#f0fdf4' },
  GRAB_FAILED: { key: 'GRAB_FAILED', label: '抢票通知', color: '#b91c1c', bg: '#fef2f2' },
  ORDER_PAYMENT_TIMEOUT: { key: 'ORDER_PAYMENT_TIMEOUT', label: '订单提醒', color: '#b45309', bg: '#fffbeb' },
  ACTIVITY_BUYER_NOTICE: { key: 'ACTIVITY_BUYER_NOTICE', label: '活动通知', color: '#2563eb', bg: '#eff6ff' },
  ACTIVITY_RESCHEDULED: { key: 'ACTIVITY_RESCHEDULED', label: '活动变更', color: '#b45309', bg: '#fffbeb' },
  ACTIVITY_CANCELLED: { key: 'ACTIVITY_CANCELLED', label: '活动变更', color: '#b91c1c', bg: '#fef2f2' },
  REFUND_REQUESTED: { key: 'REFUND_REQUESTED', label: '退款通知', color: '#2563eb', bg: '#eff6ff' },
  REFUND_APPROVED: { key: 'REFUND_APPROVED', label: '退款通知', color: '#16a34a', bg: '#f0fdf4' },
  REFUND_REJECTED: { key: 'REFUND_REJECTED', label: '退款通知', color: '#b91c1c', bg: '#fef2f2' },
  REFUND_PROCESSING: { key: 'REFUND_PROCESSING', label: '退款通知', color: '#2563eb', bg: '#eff6ff' },
  REFUND_FAILED: { key: 'REFUND_FAILED', label: '退款通知', color: '#b91c1c', bg: '#fef2f2' },
  REFUND_COMPLETED: { key: 'REFUND_COMPLETED', label: '退款通知', color: '#16a34a', bg: '#f0fdf4' },
  TEAM_LOCKED: { key: 'TEAM_LOCKED', label: '小队通知', color: '#7c3aed', bg: '#f5f3ff' },
  TEAM_PAID: { key: 'TEAM_PAID', label: '小队通知', color: '#16a34a', bg: '#f0fdf4' },
  TEAM_FAILED: { key: 'TEAM_FAILED', label: '小队通知', color: '#b91c1c', bg: '#fef2f2' },
  TEAM_EXPIRED: { key: 'TEAM_EXPIRED', label: '小队通知', color: '#b45309', bg: '#fffbeb' },
  SUPPORT_REPLY: { key: 'SUPPORT_REPLY', label: '客服消息', color: '#2563eb', bg: '#eff6ff' },
  SUPPORT_ASSIGNED: { key: 'SUPPORT_ASSIGNED', label: '客服消息', color: '#2563eb', bg: '#eff6ff' },
  SUPPORT_CLOSED: { key: 'SUPPORT_CLOSED', label: '客服消息', color: '#64748b', bg: '#f8fafc' },
  TODO: { key: 'TODO', label: '待办消息', color: '#b45309', bg: '#fffbeb' },
}

function detectNotificationType(notification: NotificationVO): string {
  const raw = (notification.type || 'IN_APP').toUpperCase()
  if (raw !== 'IN_APP') return raw
  const content = notification.content || ''
  if (content.includes('阵容变更') || content.includes('阵容调整')) return 'CAST_CHANGE'
  if (content.includes('风险停售') || content.includes('暂停售票')) return 'RISK_SUSPENDED'
  if (content.includes('恢复售票')) return 'RISK_RESUMED'
  if (content.includes('查看客服会话') || content.includes('人工客服回复')) return 'SUPPORT_REPLY'
  return 'IN_APP'
}

export function getNotificationTypeMeta(notification: NotificationVO): NotificationTypeMeta {
  const key = detectNotificationType(notification)
  return TYPE_META[key] || { key, label: '未知消息', color: '#64748b', bg: '#f8fafc' }
}

function orderHref(notification: NotificationVO) {
  return notification.orderId ? `/orders/${notification.orderId}` : '/orders'
}

export function getNotificationAction(
  notification: NotificationVO,
  role?: UserRole | string | null,
  permissionCodes: string[] = [],
): NotificationAction | null {
  if (notification.actionHref && notification.actionLabel) {
    return {
      href: notification.actionHref,
      buttonLabel: notification.actionLabel,
    }
  }

  const key = getNotificationTypeMeta(notification).key

  if (key.startsWith('GRAB_')) {
    return {
      href: orderHref(notification),
      buttonLabel: key === 'GRAB_SUCCESS' && notification.orderId ? '查看抢票订单' : '查看订单',
    }
  }

  if (key.startsWith('WAITLIST_')) {
    if (notification.orderId) {
      return {
        href: `/orders/${notification.orderId}`,
        buttonLabel: key === 'WAITLIST_OFFERED' || key === 'WAITLIST_MATCHED' ? '处理候补订单' : '查看候补订单',
      }
    }
    return { href: '/waitlist', buttonLabel: '查看候补' }
  }

  if (key === 'ORDER_PAYMENT_TIMEOUT') {
    return {
      href: orderHref(notification),
      buttonLabel: notification.orderId ? '查看待支付订单' : '查看订单',
    }
  }

  if (key.startsWith('ACTIVITY_')) {
    return { href: orderHref(notification), buttonLabel: '查看相关订单' }
  }

  if (key.startsWith('REFUND_')) {
    return {
      href: orderHref(notification),
      buttonLabel: notification.orderId ? '查看退款进度' : '查看退款订单',
    }
  }

  if (key.startsWith('TEAM_')) {
    return {
      href: orderHref(notification),
      buttonLabel: notification.orderId ? '查看小队订单' : '查看订单',
    }
  }

  if (key.startsWith('SUPPORT_')) {
    return {
      href: '/help',
      buttonLabel: '查看客服会话',
    }
  }

  if (key === 'TODO' || key.startsWith('RISK_')) {
    return {
      href: canUseConsoleAction('risk.review', permissionCodes) ? '/console/risk-resolutions' : role === 'organizer' ? '/console/risk-events' : '/notifications',
      buttonLabel: key === 'TODO' ? '查看待办' : '查看处理',
    }
  }

  if (key === 'CAST_CHANGE') {
    return { href: orderHref(notification), buttonLabel: '查看相关订单' }
  }

  if (notification.orderId) {
    return { href: `/orders/${notification.orderId}`, buttonLabel: '查看相关订单' }
  }

  return null
}

export function getNotificationContentSegments(
  content: string,
  action: NotificationAction | null,
): NotificationContentSegment[] {
  if (!action?.buttonLabel || !content.includes(action.buttonLabel)) {
    return [{ text: content }]
  }
  const start = content.indexOf(action.buttonLabel)
  const end = start + action.buttonLabel.length
  return [
    { text: content.slice(0, start) },
    { text: action.buttonLabel, href: action.href },
    { text: content.slice(end) },
  ].filter(segment => segment.text.length > 0)
}

export function shouldRenderNotificationActionButton(
  content: string,
  action: NotificationAction | null,
): boolean {
  return Boolean(action && !content.includes(action.buttonLabel))
}

export function getNotificationTime(notification: NotificationVO): number {
  if (!notification.createTime) return 0
  const time = new Date(notification.createTime).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function isNotificationUnread(notification: NotificationVO): boolean {
  return !notification.readTime
}

export function filterVisibleNotifications(items: NotificationVO[]): NotificationVO[] {
  return items.filter((item) => !item.deletedTime)
}

export function getLatestNotificationTime(items: NotificationVO[]): number {
  return items.reduce((max, item) => Math.max(max, getNotificationTime(item)), 0)
}

export function getReadNotificationIds(items: NotificationVO[]): number[] {
  return items.filter((item) => !isNotificationUnread(item)).map((item) => item.id)
}
