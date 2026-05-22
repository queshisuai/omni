'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getUser, isAuthenticated } from '@/lib/auth'
import { listMyNotifications } from '@/lib/api'
import { filterVisibleNotifications, getHiddenNotificationIds, getLatestNotificationTime, getNotificationReadAt, getNotificationTime, getReadNotificationIds, isNotificationUnread, setHiddenNotificationIds, setNotificationReadAt } from './notification-state'
import type { NotificationVO } from '@/types/api'

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  IN_APP: { label: '站内消息', color: '#ff1268' },
  CAST_CHANGE: { label: '阵容变更', color: '#b91c1c' },
  RISK_SUSPENDED: { label: '风险停售', color: '#b91c1c' },
  RISK_RESUMED: { label: '恢复售票', color: '#16a34a' },
  SMS: { label: '短信', color: '#2563eb' },
  EMAIL: { label: '邮件', color: '#2563eb' },
}

function detectType(notification: NotificationVO): string {
  const raw = (notification.type || 'IN_APP').toUpperCase()
  if (raw !== 'IN_APP') return raw
  const content = notification.content || ''
  if (content.includes('阵容变更') || content.includes('阵容调整')) return 'CAST_CHANGE'
  if (content.includes('风险停售') || content.includes('暂停售票')) return 'RISK_SUSPENDED'
  if (content.includes('恢复售票')) return 'RISK_RESUMED'
  return 'IN_APP'
}

function formatTime(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = Date.now()
  const diff = now - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function NotificationBell() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)
  const [userId, setUserId] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [readAt, setReadAt] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<number[]>([])
  const fetchTokenRef = useRef(0)

  useEffect(() => {
    const checkAuth = () => {
      const auth = isAuthenticated()
      setLoggedIn(auth)
      if (auth) {
        const user = getUser()
        const uid = user?.userId || 0
        setUserId(uid)
        setReadAt(uid ? getNotificationReadAt(uid) : 0)
        setHiddenIds(uid ? getHiddenNotificationIds(uid) : [])
      } else {
        setUserId(0)
        setItems([])
        setReadAt(0)
        setHiddenIds([])
      }
    }
    checkAuth()
    window.addEventListener('focus', checkAuth)
    window.addEventListener('damai-user-updated', checkAuth)
    return () => {
      window.removeEventListener('focus', checkAuth)
      window.removeEventListener('damai-user-updated', checkAuth)
    }
  }, [])

  const fetchNotifications = () => {
    if (!loggedIn || !userId) return
    const token = fetchTokenRef.current + 1
    fetchTokenRef.current = token
    setLoading(true)
    setError('')
    listMyNotifications(userId)
      .then((data) => {
        if (fetchTokenRef.current !== token) return
        setItems(data || [])
      })
      .catch((err: unknown) => {
        if (fetchTokenRef.current !== token) return
        setError(err instanceof Error ? err.message : '加载通知失败')
      })
      .finally(() => {
        if (fetchTokenRef.current === token) setLoading(false)
      })
  }

  useEffect(() => {
    if (!loggedIn || !userId) return
    fetchNotifications()
    const timer = window.setInterval(fetchNotifications, 60_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, userId])

  if (!loggedIn) return null

  const visibleItems = filterVisibleNotifications(items, hiddenIds)
  const unreadCount = visibleItems.reduce((acc, item) => acc + (isNotificationUnread(item, readAt) ? 1 : 0), 0)
  const readCount = getReadNotificationIds(visibleItems, readAt).length

  const markAllRead = () => {
    const latest = getLatestNotificationTime(visibleItems)
    if (latest > readAt) {
      setReadAt(latest)
      if (userId) setNotificationReadAt(userId, latest)
    }
  }

  const deleteRead = () => {
    const readIds = getReadNotificationIds(visibleItems, readAt)
    if (readIds.length === 0 || !userId) return
    const next = Array.from(new Set([...hiddenIds, ...readIds]))
    setHiddenIds(next)
    setHiddenNotificationIds(userId, next)
  }

  const handleEnter = () => {
    setOpen(true)
    if (items.length === 0 && !loading) fetchNotifications()
  }

  const handleClickBell = () => {
    markAllRead()
    setOpen(false)
    router.push('/notifications')
  }

  const handlePickItem = () => {
    markAllRead()
    setOpen(false)
    router.push('/notifications')
  }

  const previewItems = visibleItems.slice(0, 5)

  return (
    <div
      className="relative flex-shrink-0 h-full flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={handleClickBell}
        className="relative flex items-center gap-1 text-sm text-[#111] hover:text-[#ff1268] bg-transparent border-none cursor-pointer outline-none h-full"
        aria-label="站内消息"
      >
        <Bell className="w-5 h-5" />
        <span>消息</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 left-3 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ff1268] px-1 text-[10px] font-medium leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-[72px] z-50 w-[320px] rounded-b border border-[#e5e5e5] bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
            <span className="text-[14px] font-medium text-[#111]">站内消息</span>
            <div className="flex items-center gap-3">
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="cursor-pointer border-none bg-transparent text-[12px] text-[#3b82f6] outline-none hover:underline disabled:cursor-not-allowed disabled:text-[#bbb] disabled:no-underline"
              >
                全部已读
              </button>
              <button
                onClick={deleteRead}
                disabled={readCount === 0}
                className="cursor-pointer border-none bg-transparent text-[12px] text-[#ef4444] outline-none hover:underline disabled:cursor-not-allowed disabled:text-[#bbb] disabled:no-underline"
              >
                删除已读
              </button>
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#999]">加载中...</div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#b91c1c]">{error}</div>
          ) : previewItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#999]">暂无消息</div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {previewItems.map((item) => {
                const type = detectType(item)
                const meta = TYPE_LABEL[type] || TYPE_LABEL.IN_APP
                const unread = getNotificationTime(item) > readAt
                return (
                  <li key={item.id} className="border-b border-[#f5f5f5] last:border-b-0">
                    <button
                      onClick={handlePickItem}
                      className="block w-full cursor-pointer border-none bg-white px-4 py-3 text-left outline-none hover:bg-[#fafafa]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                        {unread && <span className="h-1.5 w-1.5 rounded-full bg-[#ff1268]" />}
                        <span className="ml-auto text-[11px] text-[#999]">{formatTime(item.createTime)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#333]">{item.content}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
