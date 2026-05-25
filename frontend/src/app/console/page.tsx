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
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-gray-900 mb-1">
          {user?.role === 'admin' ? '平台管理后台' : '主办方后台'}
        </h1>
        <p className="text-[14px] text-gray-500">欢迎回来，这是您的业务数据概览。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[#fff0f5] text-[#ff1268]">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-[14px] font-medium text-gray-600">我的活动</span>
          </div>
          <div>
            <div className="text-[32px] font-bold text-gray-900 leading-none">{statsError ? '加载失败' : stats?.activityCount ?? '-'}</div>
            {statsError ? <div className="mt-2 text-[12px] font-medium text-red-500">{statsError}</div> : null}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-[14px] font-medium text-gray-600">总票档数</span>
          </div>
          <div>
            <div className="text-[32px] font-bold text-gray-900 leading-none">{statsError ? '加载失败' : stats?.ticketTypeCount ?? '-'}</div>
            {statsError ? <div className="mt-2 text-[12px] font-medium text-red-500">{statsError}</div> : null}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-[14px] font-medium text-gray-600">已支付订单数</span>
          </div>
          <div>
            <div className="text-[32px] font-bold text-gray-900 leading-none">{statsError ? '加载失败' : stats?.paidOrderCount ?? '-'}</div>
            {statsError ? <div className="mt-2 text-[12px] font-medium text-red-500">{statsError}</div> : null}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">快捷操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '新建活动', href: '/console/activities/new' },
            { label: '管理活动', href: '/console/activities' },
            { label: '场馆管理', href: '/console/venue' },
            { label: '查看订单', href: '/console/orders' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="group flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <span className="text-[14px] font-medium text-gray-700 group-hover:text-gray-900">{item.label}</span>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
