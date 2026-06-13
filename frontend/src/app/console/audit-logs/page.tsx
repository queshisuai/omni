'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, RefreshCw, Search } from 'lucide-react'
import { getUserInfo, listOperationAuditLogs } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import {
  formatOperationAction,
  formatOperationTargetRef,
  formatOperationTargetType,
  formatOperatorRole,
  getOperationActionFilterOptions,
  getOperationTargetTypeFilterOptions,
} from '@/lib/operation-display'
import type { OperationAuditLogVO } from '@/types/api'

type SuccessFilter = '' | 'true' | 'false'
const operationActionFilterOptions = getOperationActionFilterOptions()
const operationTargetTypeFilterOptions = getOperationTargetTypeFilterOptions()

function formatSuccess(success: boolean) {
  return success ? '成功' : '失败'
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [items, setItems] = useState<OperationAuditLogVO[]>([])
  const [filters, setFilters] = useState({
    operatorId: '',
    action: '',
    targetType: '',
    success: '' as SuccessFilter,
    traceId: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listOperationAuditLogs({
        operatorId: filters.operatorId ? Number(filters.operatorId) : null,
        action: filters.action,
        targetType: filters.targetType,
        success: filters.success === '' ? null : filters.success === 'true',
        traceId: filters.traceId,
        limit: 100,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载操作审计日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (!canUseConsoleAction('audit.view', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        return load()
      })
      .catch(() => router.replace('/login?ru=/console/audit-logs'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const submit = () => {
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">操作审计</h1>
          <p className="mt-2 text-[14px] text-gray-500">查询后台人工操作记录，用于异常追踪和责任回溯。</p>
        </div>
        <button
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#111]">
          <Search className="h-4 w-4 text-[#ff1268]" />
          筛选
        </div>
        <div className="grid gap-3 md:grid-cols-[120px_1fr_1fr_120px_1fr_auto]">
          <input
            value={filters.operatorId}
            onChange={event => setFilters({ ...filters, operatorId: event.target.value.replace(/\D/g, '') })}
            placeholder="操作人编号"
            className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
          />
          <select
            value={filters.action}
            onChange={event => setFilters({ ...filters, action: event.target.value })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
            aria-label="操作类型"
          >
            <option value="">全部操作类型</option>
            {operationActionFilterOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.targetType}
            onChange={event => setFilters({ ...filters, targetType: event.target.value })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
            aria-label="对象类型"
          >
            <option value="">全部对象类型</option>
            {operationTargetTypeFilterOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.success}
            onChange={event => setFilters({ ...filters, success: event.target.value as SuccessFilter })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
          >
            <option value="">全部结果</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
          <input
            value={filters.traceId}
            onChange={event => setFilters({ ...filters, traceId: event.target.value })}
            placeholder="追踪编号"
            className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
          />
          <button onClick={submit} disabled={loading} className="h-10 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:opacity-60">查询</button>
        </div>
      </section>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-500">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">日志列表</div>
        {loading ? (
          <div className="py-16 text-center text-[14px] text-gray-400">正在加载操作审计日志...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-gray-400">暂无操作审计日志</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">操作人编号</th>
                  <th className="px-4 py-3 font-medium">操作类型</th>
                  <th className="px-4 py-3 font-medium">对象类型</th>
                  <th className="px-4 py-3 font-medium">结果</th>
                  <th className="px-4 py-3 font-medium">说明</th>
                  <th className="px-4 py-3 font-medium">追踪编号</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className="text-[#333]">
                    <td className="whitespace-nowrap px-4 py-3">{formatTime(item.createTime)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111]">操作人编号：{item.operatorId || '-'}</div>
                      <div className="mt-1 text-[12px] text-gray-500">{formatOperatorRole(item.operatorRole)}</div>
                    </td>
                    <td className="px-4 py-3">{formatOperationAction(item.action)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111]">{formatOperationTargetType(item.targetType)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">{formatOperationTargetRef(item.targetType, item.targetRef, item.targetId)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] ${item.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        <ClipboardList className="h-3.5 w-3.5" />
                        {formatSuccess(item.success)}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-gray-600">{item.result || item.reason || item.errorMessage || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-500">{item.traceId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
