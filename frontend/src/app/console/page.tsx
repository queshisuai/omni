'use client'

import { useEffect, useRef, useState } from 'react'
import { getUser } from '@/lib/auth'
import { getAdminSummary, getGrabOpsSummary, listAdminRefunds, listExceptionTasks, listOperationAuditLogs, listReconciliationBatches } from '@/lib/api'
import { canLoadPlatformOpsSummary } from '@/lib/console-ops'
import { getConsoleQuickActions } from '@/lib/console-paths'
import { getConsoleBrandLabel, isPlatformAdminRole } from '@/lib/console-auth'
import { buildDashboardBars, summarizeOpsMetric } from '@/lib/marketing-tools'
import { ConsoleDashboardSkeleton } from '@/components/Skeleton'
import { Activity, AlertTriangle, CalendarDays, ClipboardList, FileSearch, Gauge, RotateCcw, ShieldAlert, ShoppingCart, Ticket, TrendingUp, Users } from 'lucide-react'
import type { AdminSummaryVO, ExceptionTaskVO, GrabOpsSummaryVO, OperationAuditLogVO, ReconciliationBatchVO } from '@/types/api'

function DashboardBarList({ items, emptyText = '暂无数据' }: { items: Array<{ label: string; value: number }>; emptyText?: string }) {
  const bars = buildDashboardBars(items)
  if (bars.length === 0) return <div className="text-[13px] text-gray-400">{emptyText}</div>
  return (
    <div className="space-y-3">
      {bars.map(item => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-gray-700">{item.label}</span>
            <span className="shrink-0 font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#ff1268]"
              style={{ width: item.widthPercent > 0 ? `${Math.max(item.widthPercent, 4)}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function formatBatchStatus(status?: string | null) {
  if (status === 'generated') return '已生成'
  if (status === 'processing') return '处理中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return status || '-'
}

export default function ConsoleHome() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null)
  const [stats, setStats] = useState<AdminSummaryVO | null>(null)
  const [grabOps, setGrabOps] = useState<GrabOpsSummaryVO | null>(null)
  const [refundOps, setRefundOps] = useState<{ totalCount: number; abnormalCount: number } | null>(null)
  const [platformOps, setPlatformOps] = useState<{
    pendingExceptions: ExceptionTaskVO[]
    latestBatch: ReconciliationBatchVO | null
    latestAudit: OperationAuditLogVO | null
  } | null>(null)
  const [statsError, setStatsError] = useState('')
  const [summaryReady, setSummaryReady] = useState(false)
  const loadSummaryRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const loadSummary = () => {
    const u = getUser()
    setUser(u)
    if (u) {
      setStats(null)
      setGrabOps(null)
      setRefundOps(null)
      setPlatformOps(null)
      setStatsError('')
      setSummaryReady(false)
      const canLoadBusinessSummary = isPlatformAdminRole(u.role) || u.role === 'organizer'
      if (!canLoadBusinessSummary) {
        setSummaryReady(true)
        return
      }
      getAdminSummary()
        .then(res => {
          setStats(res)
          setSummaryReady(true)
          if (canLoadPlatformOpsSummary(u.role)) {
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
            Promise.all([
              listExceptionTasks(),
              listReconciliationBatches(),
              listOperationAuditLogs({ limit: 5 }),
            ])
              .then(([tasks, batches, audits]) => {
                setPlatformOps({
                  pendingExceptions: tasks.filter(task => task.status !== 'resolved'),
                  latestBatch: batches[0] || null,
                  latestAudit: audits[0] || null,
                })
              })
              .catch(() => setPlatformOps(null))
          }
        })
        .catch(() => {
          setStatsError('统计加载失败')
          setSummaryReady(true)
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

  if (!summaryReady) {
    return <ConsoleDashboardSkeleton />
  }

  const quickActions = getConsoleQuickActions(user?.role, user?.permissionCodes || [])
  const canShowBusinessStats = isPlatformAdminRole(user?.role) || user?.role === 'organizer'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-gray-900 mb-1">
          {getConsoleBrandLabel(user?.role, user?.permissionCodes || [])}
        </h1>
        <p className="text-[14px] text-gray-500">{canShowBusinessStats ? '欢迎回来，这是您的业务数据概览。' : '欢迎回来，请从下方入口进入可管理的功能。'}</p>
      </div>

      {canShowBusinessStats && <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
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
      </div>}

      <div className="mb-6">
        {canLoadPlatformOpsSummary(user?.role) && (
          <div className="mb-8">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">运营驾驶舱</h2>
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <a href="/console/exception-tasks" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-[#ff1268] hover:shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <ShieldAlert className="h-4 w-4 text-[#dc2626]" /> 待处理异常
                </div>
                <div className="text-[28px] font-bold leading-none text-gray-900">{platformOps?.pendingExceptions.length ?? '-'}</div>
                <div className="mt-2 text-[12px] text-gray-500">支付、退款、出票、库存等异常任务</div>
              </a>
              <a href="/console/reconciliation" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-[#ff1268] hover:shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <FileSearch className="h-4 w-4 text-[#2563eb]" /> 最近对账批次
                </div>
                <div className="text-[20px] font-bold leading-tight text-gray-900">{platformOps?.latestBatch?.bizDate || '暂无批次'}</div>
                <div className="mt-2 text-[12px] text-gray-500">{formatBatchStatus(platformOps?.latestBatch?.status)}</div>
              </a>
              <a href="/console/audit-logs" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-[#ff1268] hover:shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <ClipboardList className="h-4 w-4 text-[#16a34a]" /> 最新人工操作
                </div>
                <div className="truncate text-[16px] font-bold leading-tight text-gray-900">{platformOps?.latestAudit?.action || '暂无记录'}</div>
                <div className="mt-2 text-[12px] text-gray-500">{formatDateTime(platformOps?.latestAudit?.createTime)}</div>
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <TrendingUp className="h-4 w-4 text-[#ff1268]" /> 热门活动实时流量
                </div>
                <DashboardBarList items={(stats?.hotActivities ?? []).slice(0, 5).map(item => ({ label: item.activityName, value: item.orderCount }))} />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <AlertTriangle className="h-4 w-4 text-[#f97316]" /> 抢票失败原因分布
                </div>
                <DashboardBarList items={(grabOps?.failureReasons ?? []).slice(0, 5).map(item => ({ label: item.reason, value: item.count }))} />
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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {quickActions.map(item => (
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
