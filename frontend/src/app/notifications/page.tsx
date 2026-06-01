'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { listMyNotifications } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { filterVisibleNotifications, getHiddenNotificationIds, getLatestNotificationTime, getNotificationAction, getNotificationContentSegments, getNotificationReadAt, getNotificationTypeMeta, getReadNotificationIds, isNotificationUnread, setHiddenNotificationIds, setNotificationReadAt, shouldRenderNotificationActionButton } from '@/components/notification-state'
import type { NotificationVO, UserRole } from '@/types/api'

function formatTime(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationVO[]>([])
  const [userId, setUserId] = useState(0)
  const [role, setRole] = useState<UserRole | null>(null)
  const [readAt, setReadAt] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<number[]>([])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    const user = getUser()
    if (!user?.userId) {
      router.replace('/login')
      return
    }
    const uid = Number(user.userId)
    setUserId(uid)
    setRole(user.role || null)
    setReadAt(getNotificationReadAt(uid))
    setHiddenIds(getHiddenNotificationIds(uid))
    let cancelled = false
    setLoading(true)
    setError(null)
    listMyNotifications()
      .then((items) => { if (!cancelled) setNotifications(items || []) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : '加载通知失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [router])

  const visibleNotifications = filterVisibleNotifications(notifications, hiddenIds)

  const unreadCount = visibleNotifications.reduce((acc, item) => acc + (isNotificationUnread(item, readAt) ? 1 : 0), 0)
  const readCount = getReadNotificationIds(visibleNotifications, readAt).length

  const markAllRead = () => {
    if (!userId) return
    const latest = getLatestNotificationTime(visibleNotifications)
    setReadAt(latest)
    setNotificationReadAt(userId, latest)
  }

  const deleteRead = () => {
    if (!userId) return
    const readIds = getReadNotificationIds(visibleNotifications, readAt)
    if (readIds.length === 0) return
    const next = Array.from(new Set([...hiddenIds, ...readIds]))
    setHiddenIds(next)
    setHiddenNotificationIds(userId, next)
  }

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-5 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] text-[#111] font-medium">站内消息</h1>
            <p className="mt-1 text-[13px] text-[#999]">删除只会隐藏当前设备上的已读消息，后端消息记录不会被物理删除。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="cursor-pointer rounded border border-[#ff1268] bg-white px-3 py-1.5 text-[13px] text-[#ff1268] outline-none disabled:cursor-not-allowed disabled:border-[#ddd] disabled:text-[#bbb]"
            >
              全部已读
            </button>
            <button
              type="button"
              onClick={deleteRead}
              disabled={readCount === 0}
              className="cursor-pointer rounded border border-[#ef4444] bg-white px-3 py-1.5 text-[13px] text-[#ef4444] outline-none disabled:cursor-not-allowed disabled:border-[#ddd] disabled:text-[#bbb]"
            >
              删除已读
            </button>
          </div>
        </div>

        {loading && <div className="text-[14px] text-[#666]">加载中...</div>}
        {error && <div className="rounded bg-[#fef2f2] px-4 py-3 text-[14px] text-[#b91c1c]">{error}</div>}

        {!loading && !error && visibleNotifications.length === 0 && (
          <div className="rounded bg-white border border-[#eee] px-6 py-10 text-center text-[14px] text-[#999]">
            暂无消息
          </div>
        )}

        <div className="space-y-3">
          {visibleNotifications.map((item) => {
            const meta = getNotificationTypeMeta(item)
            const action = getNotificationAction(item, role)
            const contentSegments = getNotificationContentSegments(item.content, action)
            const unread = isNotificationUnread(item, readAt)
            return (
              <div key={item.id} className="rounded border border-[#eee] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                  {unread && <span className="rounded-full bg-[#ff1268] px-2 py-0.5 text-[11px] text-white">未读</span>}
                  <span className="text-[12px] text-[#999]">{formatTime(item.createTime)}</span>
                  {shouldRenderNotificationActionButton(item.content, action) && action && (
                    <button
                      type="button"
                      onClick={() => router.push(action.href)}
                      className="ml-auto cursor-pointer border-none bg-transparent text-[12px] text-[#3b82f6] outline-none hover:underline"
                    >
                      {action.buttonLabel}
                    </button>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-line text-[14px] leading-6 text-[#333]">
                  {contentSegments.map((segment, index) => segment.href ? (
                    <button
                      key={`${segment.text}-${index}`}
                      type="button"
                      onClick={() => router.push(segment.href as string)}
                      className="inline cursor-pointer border-none bg-transparent p-0 text-[#3b82f6] outline-none hover:underline"
                    >
                      {segment.text}
                    </button>
                  ) : (
                    <span key={`${segment.text}-${index}`}>{segment.text}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>
      <Footer />
    </>
  )
}
