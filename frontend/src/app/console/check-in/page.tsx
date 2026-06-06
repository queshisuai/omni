'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { getCheckInOverview, listCheckInRecords } from '@/lib/api'
import { hasConsolePermission } from '@/lib/console-auth'
import type { CheckInOverviewVO, CheckInRecordVO } from '@/types/api'

const RESULT_TABS: Array<{ label: string; value: '' | 'SUCCESS' | 'DUPLICATE' | 'FAILED' }> = [
  { label: '全部', value: '' },
  { label: '成功', value: 'SUCCESS' },
  { label: '重复', value: 'DUPLICATE' },
  { label: '失败', value: 'FAILED' },
]

const RESULT_LABELS: Record<string, string> = {
  SUCCESS: '成功',
  DUPLICATE: '重复',
  FAILED: '失败',
}

const RESULT_STYLES: Record<string, string> = {
  SUCCESS: 'bg-[#f0fff4] text-[#16a34a]',
  DUPLICATE: 'bg-[#fff7ed] text-[#f97316]',
  FAILED: 'bg-[#fef2f2] text-[#dc2626]',
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function formatNullable(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

export default function ConsoleCheckInPage() {
  const user = typeof window === 'undefined' ? null : getUser()
  const permissions = user?.permissionCodes || []
  const canView = hasConsolePermission(user?.role, permissions, 'checkin.view')
  const [sessionIdInput, setSessionIdInput] = useState('')
  const [resultFilter, setResultFilter] = useState<'' | 'SUCCESS' | 'DUPLICATE' | 'FAILED'>('')
  const [overview, setOverview] = useState<CheckInOverviewVO | null>(null)
  const [records, setRecords] = useState<CheckInRecordVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [queried, setQueried] = useState(false)

  const sessionId = useMemo(() => {
    const trimmed = sessionIdInput.trim()
    if (!/^\d+$/.test(trimmed)) return null
    const value = Number(trimmed)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }, [sessionIdInput])

  const loadCheckInData = async () => {
    if (!sessionId) {
      setError('场次ID不正确')
      return
    }
    setLoading(true)
    setError('')
    setQueried(true)
    try {
      const [overviewData, recordData] = await Promise.all([
        getCheckInOverview(sessionId),
        listCheckInRecords({ sessionId, result: resultFilter || undefined, page: 1, size: 50 }),
      ])
      setOverview(overviewData)
      setRecords(recordData)
    } catch (err) {
      setOverview(null)
      setRecords([])
      setError(err instanceof Error ? err.message : '入场核验记录暂不可用')
    } finally {
      setLoading(false)
    }
  }

  if (!canView) {
    return (
      <div>
        <h1 className="mb-5 text-[22px] font-bold text-[#1a1a2e]">入场核验</h1>
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">
          暂无入场核验查看权限
        </div>
      </div>
    )
  }

  const overviewItems = [
    { label: '总票数', value: overview?.totalTickets ?? 0 },
    { label: '已验票', value: overview?.checkedInCount ?? 0 },
    { label: '未入场', value: overview?.unusedCount ?? 0 },
    { label: '失败', value: overview?.failedCount ?? 0 },
    { label: '重复扫码', value: overview?.duplicateCount ?? 0 },
  ]

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-bold text-[#1a1a2e]">入场核验</h1>

      <div className="mb-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-[#555]">场次 ID</span>
            <input
              value={sessionIdInput}
              onChange={event => setSessionIdInput(event.target.value)}
              placeholder="请输入场次 ID"
              className="h-10 w-full rounded-lg border border-[#d9d9d9] px-3 text-[14px] outline-none focus:border-[#ff1268]"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[#555]">结果</span>
            <div className="flex flex-wrap gap-2">
              {RESULT_TABS.map(tab => (
                <button
                  key={tab.value || 'ALL'}
                  type="button"
                  onClick={() => setResultFilter(tab.value)}
                  className={`h-10 rounded-lg border px-3 text-[13px] transition ${
                    resultFilter === tab.value
                      ? 'border-[#ff1268] bg-[#fff1f6] text-[#ff1268]'
                      : 'border-[#e5e5e5] bg-white text-[#666] hover:border-[#ff1268] hover:text-[#ff1268]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={loadCheckInData}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? '查询中' : '查询'}
          </button>
        </div>
        {error ? <div className="mt-3 text-[13px] text-[#dc2626]">{error}</div> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {overviewItems.map(item => (
          <div key={item.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
            <div className="text-[13px] text-[#666]">{item.label}</div>
            <div className="mt-2 text-[26px] font-bold leading-none text-[#1a1a2e]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <th className="p-3 text-left font-medium text-[#666]">请求号</th>
              <th className="p-3 text-left font-medium text-[#666]">票号</th>
              <th className="p-3 text-left font-medium text-[#666]">设备</th>
              <th className="p-3 text-left font-medium text-[#666]">渠道</th>
              <th className="p-3 text-left font-medium text-[#666]">结果</th>
              <th className="p-3 text-left font-medium text-[#666]">失败原因</th>
              <th className="p-3 text-left font-medium text-[#666]">时间</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id ?? record.requestId} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                <td className="p-3 font-medium text-[#333]">{formatNullable(record.requestId)}</td>
                <td className="p-3 text-[#333]">{formatNullable(record.ticketNo)}</td>
                <td className="p-3 text-[#666]">{formatNullable(record.deviceCode)}</td>
                <td className="p-3 text-[#666]">{formatNullable(record.channel)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[12px] ${RESULT_STYLES[record.result] || 'bg-[#f5f5f5] text-[#666]'}`}>
                    {RESULT_LABELS[record.result] || record.result}
                  </span>
                </td>
                <td className="p-3 text-[#666]">{formatNullable(record.failureReason)}</td>
                <td className="p-3 text-[#999]">{formatDateTime(record.checkedInAt || record.createTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && queried && records.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#999]">暂无核验记录</div>
        ) : null}
        {!loading && !queried ? (
          <div className="py-16 text-center text-[14px] text-[#999]">暂无核验记录</div>
        ) : null}
        {loading ? (
          <div className="py-16 text-center text-[14px] text-[#999]">正在加载核验记录</div>
        ) : null}
      </div>
    </div>
  )
}
