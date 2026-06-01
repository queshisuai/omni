'use client'

import { useEffect, useRef, useState } from 'react'
import { getUser } from '@/lib/auth'
import { getAdminSummary, getGrabOpsSummary, listAdminRefunds } from '@/lib/api'
import { summarizeOpsMetric } from '@/lib/marketing-tools'
import { Activity, AlertTriangle, CalendarDays, Gauge, RotateCcw, ShoppingCart, Ticket, TrendingUp, Users } from 'lucide-react'
import type { AdminSummaryVO, GrabOpsSummaryVO } from '@/types/api'

export default function ConsoleHome() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null)
  const [stats, setStats] = useState<AdminSummaryVO | null>(null)
  const [grabOps, setGrabOps] = useState<GrabOpsSummaryVO | null>(null)
  const [refundOps, setRefundOps] = useState<{ totalCount: number; abnormalCount: number } | null>(null)
  const [statsError, setStatsError] = useState('')
  const loadSummaryRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const loadSummary = () => {
    const u = getUser()
    setUser(u)
    if (u) {
      setStats(null)
      setGrabOps(null)
      setRefundOps(null)
      setStatsError('')
      getAdminSummary()
        .then(res => {
          setStats(res)
          if (u.role === 'admin') {
            getGrabOpsSummary()
              .then(setGrabOps)
              .catch(() => setGrabOps(null))
            listAdminRefunds()
              .then((refunds) => {
                setRefundOps({
                  totalCount: refunds.length,
                  abnormalCount: refunds.filter((refund) => refund.status === 3 || refund.status === 4).length,
                })
              })
              .catch(() => setRefundOps(null))
          }
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
        {user?.role === 'admin' && (
          <div className="mb-8">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">运营驾驶舱</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <TrendingUp className="h-4 w-4 text-[#ff1268]" /> 热门活动实时流量
                </div>
                <div className="space-y-2">
                  {(stats?.hotActivities ?? []).slice(0, 3).map((item) => (
                    <div key={item.activityId} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-gray-700">{item.activityName}</span>
                      <span className="shrink-0 font-semibold text-gray-900">{item.orderCount} 单</span>
                    </div>
                  ))}
                  {(stats?.hotActivities ?? []).length === 0 ? <div className="text-[13px] text-gray-400">暂无数据</div> : null}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <AlertTriangle className="h-4 w-4 text-[#f97316]" /> 抢票失败原因分布
                </div>
                <div className="space-y-2">
                  {(grabOps?.failureReasons ?? []).slice(0, 3).map((item) => (
                    <div key={item.reason} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-gray-700">{item.reason}</span>
                      <span className="shrink-0 font-semibold text-gray-900">{item.count}</span>
                    </div>
                  ))}
                  {(grabOps?.failureReasons ?? []).length === 0 ? <div className="text-[13px] text-gray-400">暂无数据</div> : null}
                </div>
              </div>

              {[
                {
                  label: '候补转化率',
                  value: grabOps ? summarizeOpsMetric({ numerator: grabOps.waitlist.paidCount, denominator: grabOps.waitlist.totalCount }) : '暂无数据',
                  icon: Users,
                  color: 'text-[#2563eb]',
                },
                {
                  label: '支付超时率',
                  value: summarizeOpsMetric({ numerator: stats?.paymentTimeoutCount ?? 0, denominator: stats?.orderCount ?? 0 }),
                  icon: Gauge,
                  color: 'text-[#f97316]',
                },
                {
                  label: '退款异常率',
                  value: summarizeOpsMetric({
                    numerator: refundOps?.abnormalCount ?? stats?.refundAbnormalCount ?? 0,
                    denominator: refundOps?.totalCount ?? stats?.refundRequestCount ?? 0,
                  }),
                  icon: RotateCcw,
                  color: 'text-[#dc2626]',
                },
                {
                  label: '风控命中率',
                  value: summarizeOpsMetric({ numerator: stats?.riskHitCount ?? 0, denominator: stats?.riskCheckCount ?? 0 }),
                  icon: Activity,
                  color: 'text-[#16a34a]',
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                      <Icon className={`h-4 w-4 ${item.color}`} /> {item.label}
                    </div>
                    <div className="text-[28px] font-bold leading-none text-gray-900">{item.value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">快捷操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '新建活动', href: '/console/activities/new' },
            { label: '管理活动', href: '/console/activities' },
            { label: '场馆记录', href: '/console/venue' },
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
