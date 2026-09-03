'use client'

import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { getUser } from '@/lib/auth'
import { getCheckInOverview, listCheckInRecords } from '@/lib/api'
import { hasConsolePermission } from '@/lib/console-auth'
import {
  buildConsoleCheckInExceptionExportCsv,
  buildConsoleCheckInExceptionExportExcelHtml,
  buildConsoleCheckInExportCsv,
  buildConsoleCheckInExportExcelHtml,
  formatConsoleCheckInResult,
  getConsoleCheckInExceptionRecords,
  getConsoleCheckInResultClassName,
} from '@/lib/console-check-in'
import type { CheckInOverviewVO, CheckInRecordVO } from '@/types/api'

const RESULT_TABS: Array<{ label: string; value: '' | 'SUCCESS' | 'DUPLICATE' | 'FAILED' }> = [
  { label: '全部', value: '' },
  { label: '成功', value: 'SUCCESS' },
  { label: '重复', value: 'DUPLICATE' },
  { label: '失败', value: 'FAILED' },
]

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
  const [exportMessage, setExportMessage] = useState('')
  const [queried, setQueried] = useState(false)
  const [page, setPage] = useState(1)

  const sessionId = useMemo(() => {
    const trimmed = sessionIdInput.trim()
    if (!/^\d+$/.test(trimmed)) return null
    const value = Number(trimmed)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }, [sessionIdInput])
  const pageRecords = useMemo(() => records.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [records, page])

  const loadCheckInData = async () => {
    if (!sessionId) {
      setError('场次编号不正确')
      setExportMessage('')
      return
    }
    setLoading(true)
    setError('')
    setExportMessage('')
    setQueried(true)
    try {
      const [overviewData, recordData] = await Promise.all([
        getCheckInOverview(sessionId),
        listCheckInRecords({ sessionId, result: resultFilter || undefined, page: 1, size: 50 }),
      ])
      setOverview(overviewData)
      setRecords(recordData)
      setPage(1)
    } catch (err) {
      setOverview(null)
      setRecords([])
      setError(err instanceof Error ? err.message : '入场核验记录暂不可用')
    } finally {
      setLoading(false)
    }
  }

  const downloadRecords = (content: string, filenamePrefix: string, type: string, extension: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportRecords = () => {
    if (records.length === 0) {
      setExportMessage('暂无可导出的核验记录')
      return
    }
    downloadRecords(buildConsoleCheckInExportCsv(records), '核验记录', 'text/csv;charset=utf-8', 'csv')
    setExportMessage(`已导出 ${records.length} 条核验记录`)
  }

  const exportRecordsExcel = () => {
    if (records.length === 0) {
      setExportMessage('暂无可导出的核验记录')
      return
    }
    downloadRecords(buildConsoleCheckInExportExcelHtml(records), '核验记录', 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setExportMessage(`已导出 ${records.length} 条核验 Excel 明细`)
  }

  const exportExceptionRecords = () => {
    const exceptionRecords = getConsoleCheckInExceptionRecords(records)
    if (exceptionRecords.length === 0) {
      setExportMessage('暂无可导出的异常核验记录')
      return
    }
    downloadRecords(buildConsoleCheckInExceptionExportCsv(records), '异常核验记录', 'text/csv;charset=utf-8', 'csv')
    setExportMessage(`已导出 ${exceptionRecords.length} 条异常核验记录`)
  }

  const exportExceptionRecordsExcel = () => {
    const exceptionRecords = getConsoleCheckInExceptionRecords(records)
    if (exceptionRecords.length === 0) {
      setExportMessage('暂无可导出的异常核验记录')
      return
    }
    downloadRecords(buildConsoleCheckInExceptionExportExcelHtml(records), '异常核验记录', 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setExportMessage(`已导出 ${exceptionRecords.length} 条异常核验 Excel 明细`)
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
            <span className="mb-1.5 block text-[13px] font-medium text-[#555]">场次编号</span>
            <input
              value={sessionIdInput}
              onChange={event => setSessionIdInput(event.target.value)}
              placeholder="请输入场次编号"
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
                  onClick={() => {
                    setResultFilter(tab.value)
                    setPage(1)
                  }}
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
          <button
            type="button"
            onClick={exportRecords}
            disabled={loading || records.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#333] transition hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出核验记录
          </button>
          <button
            type="button"
            onClick={exportRecordsExcel}
            disabled={loading || records.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#333] transition hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出 Excel
          </button>
          <button
            type="button"
            onClick={exportExceptionRecords}
            disabled={loading || records.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ffd591] bg-[#fffaf0] px-4 text-[14px] font-medium text-[#ad6800] transition hover:border-[#ffb84d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出异常报表
          </button>
          <button
            type="button"
            onClick={exportExceptionRecordsExcel}
            disabled={loading || records.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ffd591] bg-[#fffaf0] px-4 text-[14px] font-medium text-[#ad6800] transition hover:border-[#ffb84d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出异常 Excel
          </button>
        </div>
        {error ? <div className="mt-3 text-[13px] text-[#dc2626]">{error}</div> : null}
        {exportMessage ? <div className="mt-3 text-[13px] text-[#16a34a]">{exportMessage}</div> : null}
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
              <th className="p-3 text-left font-medium text-[#666]">核验时间</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map(record => (
              <tr key={record.id ?? record.requestId} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                <td className="p-3 font-medium text-[#333]">{formatNullable(record.requestId)}</td>
                <td className="p-3 text-[#333]">{formatNullable(record.ticketNo)}</td>
                <td className="p-3 text-[#666]">{formatNullable(record.deviceCode)}</td>
                <td className="p-3 text-[#666]">{formatNullable(record.channel)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[12px] ${getConsoleCheckInResultClassName(record.result)}`}>
                    {formatConsoleCheckInResult(record.result)}
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
        {!loading && records.length > 0 ? (
          <div className="border-t border-[#f0f0f0] px-4 pb-4">
            <GlobalPagination page={page} total={records.length} loading={loading} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
