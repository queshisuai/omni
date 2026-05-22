'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { listMyNotifications } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import type { NotificationVO } from '@/types/api'

const TYPE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  IN_APP: { label: '站内消息', color: '#ff1268', bg: '#fff0f5' },
  CAST_CHANGE: { label: '阵容变更', color: '#b91c1c', bg: '#fef2f2' },
  RISK_SUSPENDED: { label: '风险停售', color: '#b91c1c', bg: '#fef2f2' },
  RISK_RESUMED: { label: '恢复售票', color: '#16a34a', bg: '#f0fdf4' },
  SMS: { label: '短信', color: '#2563eb', bg: '#eff6ff' },
  EMAIL: { label: '邮件', color: '#2563eb', bg: '#eff6ff' },
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
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationVO[]>([])
  const [filter, setFilter] = useState<'all' | 'risk'>('all')

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
    let cancelled = false
    setLoading(true)
    setError(null)
    listMyNotifications(Number(user.userId))
      .then((items) => { if (!cancelled) setNotifications(items || []) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : '加载通知失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [router])

  const visible = notifications.filter((item) => {
    if (filter === 'all') return true
    const type = detectType(item)
    return type === 'CAST_CHANGE' || type === 'RISK_SUSPENDED' || type === 'RISK_RESUMED'
  })

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-5 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <h1 className="text-[24px] text-[#111] font-medium mb-6">站内消息</h1>

        <div className="flex gap-0 mb-6 border-b border-[#e5e5e5]">
          {(
            [
              { key: 'all', label: '全部消息' },
              { key: 'risk', label: '风险与阵容变更' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="cursor-pointer border-none bg-transparent outline-none px-6 py-3 text-[14px] transition-colors border-b-2 -mb-[1px]"
              style={{
                color: filter === tab.key ? '#ff1268' : '#666',
                borderBottomColor: filter === tab.key ? '#ff1268' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-[14px] text-[#666]">加载中...</div>}
        {error && <div className="rounded bg-[#fef2f2] px-4 py-3 text-[14px] text-[#b91c1c]">{error}</div>}

        {!loading && !error && visible.length === 0 && (
          <div className="rounded bg-white border border-[#eee] px-6 py-10 text-center text-[14px] text-[#999]">
            暂无消息
          </div>
        )}

        <div className="space-y-3">
          {visible.map((item) => {
            const type = detectType(item)
            const meta = TYPE_LABEL[type] || TYPE_LABEL.IN_APP
            const isCastChange = type === 'CAST_CHANGE'
            return (
              <div key={item.id} className="rounded border border-[#eee] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                  <span className="text-[12px] text-[#999]">{formatTime(item.createTime)}</span>
                  {item.orderId && (
                    <button
                      type="button"
                      onClick={() => router.push('/orders')}
                      className="ml-auto cursor-pointer border-none bg-transparent text-[12px] text-[#3b82f6] outline-none hover:underline"
                    >
                      查看相关订单
                    </button>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-line text-[14px] leading-6 text-[#333]">{item.content}</div>
                {isCastChange && item.orderId && (
                  <div className="mt-3 rounded bg-[#fff7fa] px-3 py-2 text-[12px] leading-5 text-[#b91c1c]">
                    如阵容调整影响您的观演决策，可在「订单管理」中选择「阵容变更专属退款」走加速通道。
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
      <Footer />
    </>
  )
}
