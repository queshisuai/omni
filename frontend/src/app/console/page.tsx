'use client'

import { useEffect, useRef, useState } from 'react'
import { getUser } from '@/lib/auth'
import { getAdminSummary } from '@/lib/api'
import { CalendarDays, ShoppingCart, Ticket } from 'lucide-react'

export default function ConsoleHome() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null)
  const [stats, setStats] = useState<{ activityCount: number; ticketTypeCount: number; paidOrderCount: number } | null>(null)
  const [statsError, setStatsError] = useState('')
  const loadSummaryRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const loadSummary = () => {
    const u = getUser()
    setUser(u)
    if (u) {
      setStats(null)
      setStatsError('')
      getAdminSummary(u.userId)
        .then(res => {
          setStats(res)
        })
        .catch(() => {
          setStatsError('统计加载失败')
        })
    }
  }

  loadSummaryRef.current = loadSummary

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadSummaryRef.current()
  }

  useEffect(() => {
    loadSummary()
  }, [])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshWhenVisible()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <div>
      <h1 className="text-[24px] font-bold text-[#1a1a2e] mb-6">
        {user?.role === 'admin' ? '平台管理后台' : '主办方后台'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#fff0f3] flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-[#ff1268]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">{statsError ? '加载失败' : stats?.activityCount ?? '-'}</div>
              <div className="text-[13px] text-[#999]">我的活动</div>
              {statsError ? <div className="mt-1 text-[12px] text-[#ef4444]">{statsError}</div> : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#f0f7ff] flex items-center justify-center">
              <Ticket className="w-6 h-6 text-[#3b82f6]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">{statsError ? '加载失败' : stats?.ticketTypeCount ?? '-'}</div>
              <div className="text-[13px] text-[#999]">总票档数</div>
              {statsError ? <div className="mt-1 text-[12px] text-[#ef4444]">{statsError}</div> : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#f0fff4] flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-[#22c55e]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">{statsError ? '加载失败' : stats?.paidOrderCount ?? '-'}</div>
              <div className="text-[13px] text-[#999]">已支付订单数</div>
              {statsError ? <div className="mt-1 text-[12px] text-[#ef4444]">{statsError}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
        <h2 className="text-[16px] font-bold text-[#1a1a2e] mb-4">快速入口</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '新建活动', href: '/console/activities/new', color: '#ff1268' },
            { label: '管理活动', href: '/console/activities', color: '#3b82f6' },
            { label: '场馆管理', href: '/console/venue', color: '#22c55e' },
            { label: '查看订单', href: '/console/orders', color: '#f59e0b' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="block text-center py-3 px-4 rounded-lg border border-[#e5e5e5] text-[14px] font-medium hover:border-current transition-colors"
              style={{ color: item.color }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
