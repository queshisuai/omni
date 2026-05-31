'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { listAdminRiskCases } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/Pagination'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ActivityRiskCaseVO } from '@/types/api'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_response: { label: '待主办方处理', color: '#6b7280', bg: '#f3f4f6' },
  pending: { label: '待平台审核', color: '#b45309', bg: '#fffbeb' },
  approved: { label: '已通过', color: '#15803d', bg: '#f0fdf4' },
  rejected: { label: '已驳回', color: '#b91c1c', bg: '#fef2f2' },
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function RiskCasesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cases, setCases] = useState<ActivityRiskCaseVO[]>([])
  const [filter, setFilter] = useState<'all' | 'awaiting_response' | 'pending' | 'approved' | 'rejected'>('all')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listAdminRiskCases()
      setCases(data || [])
      setPage(1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载风险案例失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (!user) return
    load()
  }, [])

  const visible = useMemo(() => {
    if (filter === 'all') return cases
    return cases.filter(item => (item.latestResolutionStatus || 'awaiting_response') === filter)
  }, [filter, cases])
  const pageVisible = useMemo(() => visible.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [visible, page])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">风险案例管理</h1>
          <p className="mt-1 text-[13px] text-[#999]">管理由风险艺人引发或平台主动停售的活动，配合恢复售票审核使用。</p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]"
        >
          <RefreshCw className="h-4 w-4" /> 刷新
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {([
          { key: 'all', label: '全部' },
          { key: 'awaiting_response', label: '待主办方处理' },
          { key: 'pending', label: '待平台审核' },
          { key: 'approved', label: '已恢复' },
          { key: 'rejected', label: '已驳回' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(1) }}
            className="rounded-full border bg-white px-3 py-1 text-[12px] outline-none"
            style={{
              borderColor: filter === tab.key ? '#ff1268' : '#ddd',
              color: filter === tab.key ? '#ff1268' : '#666',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无风险案例</div>
      ) : (
        <div className="space-y-3">
          {pageVisible.map(item => {
            const status = item.latestResolutionStatus || 'awaiting_response'
            const meta = STATUS_META[status]
            return (
              <div key={item.activityId} className="rounded-xl border border-[#ffd9e6] bg-white p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff1268]" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-medium text-[#111]">{item.activityName}</span>
                      <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[12px] text-[#b91c1c]">风险停票</span>
                      {meta && <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>}
                      <span className="text-[12px] text-[#999]">活动 ID：{item.activityId} · 主办 {item.organizerId}</span>
                    </div>
                    {item.riskSuspendedReason && <div className="mt-2 text-[13px] leading-5 text-[#666]">停售原因：{item.riskSuspendedReason}</div>}
                    {item.riskSuspendedAt && <div className="mt-1 text-[12px] text-[#999]">停售时间：{formatDate(item.riskSuspendedAt)}</div>}
                    {item.latestResolutionNote && <div className="mt-2 rounded bg-[#f9fafb] px-3 py-2 text-[12px] leading-5 text-[#444]">最近一次处置：{item.latestResolutionNote}</div>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    {status === 'pending' ? (
                      <Link
                        href={`/console/risk-resolutions?status=pending&activityId=${item.activityId}`}
                        className="rounded-lg border border-[#ff1268] px-4 py-2 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]"
                      >
                        去审核处置
                      </Link>
                    ) : status === 'approved' || status === 'rejected' ? (
                      <Link
                        href={`/console/risk-resolutions?status=${status}&activityId=${item.activityId}`}
                        className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268]"
                      >
                        查看恢复记录
                      </Link>
                    ) : (
                      <span className="rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] text-[#666]">等待主办方处理</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <Pagination page={page} total={visible.length} loading={loading} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
