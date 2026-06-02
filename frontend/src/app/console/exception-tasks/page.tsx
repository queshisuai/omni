'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, ShieldAlert } from 'lucide-react'
import { createExceptionTask, listExceptionTasks } from '@/lib/api'
import type { ExceptionTaskCreatePayload, ExceptionTaskVO } from '@/types/api'

const severityOptions = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已处理' },
]

const taskTypeOptions = [
  { value: 'payment_abnormal', label: '支付异常' },
  { value: 'refund_failed', label: '退款失败' },
  { value: 'ticket_issue_failed', label: '出票失败' },
  { value: 'stock_deduct_failed', label: '库存扣减失败' },
  { value: 'duplicate_payment', label: '重复支付' },
]

const severityText: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const statusText: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已处理',
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function initialForm(): ExceptionTaskCreatePayload {
  return {
    taskType: 'refund_failed',
    severity: 'high',
    businessNo: '',
    orderNo: '',
    paymentNo: '',
    refundNo: '',
    ticketNo: '',
    reason: '',
  }
}

export default function ExceptionTasksPage() {
  const [items, setItems] = useState<ExceptionTaskVO[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState<ExceptionTaskCreatePayload>(initialForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async (status = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      setItems(await listExceptionTasks(status || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载异常任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredItems = useMemo(() => {
    if (!statusFilter) return items
    return items.filter(item => item.status === statusFilter)
  }, [items, statusFilter])

  const pendingCount = items.filter(item => item.status !== 'resolved').length
  const highCount = items.filter(item => item.severity === 'high' && item.status !== 'resolved').length

  const changeStatus = (status: string) => {
    setStatusFilter(status)
    void load(status)
  }

  const submit = async () => {
    setError('')
    setMessage('')
    if (!form.taskType.trim() || !form.severity.trim() || !form.reason?.trim()) {
      setError('请填写任务类型、等级和异常原因')
      return
    }
    setSaving(true)
    try {
      await createExceptionTask({
        ...form,
        businessNo: form.businessNo?.trim() || null,
        orderNo: form.orderNo?.trim() || null,
        paymentNo: form.paymentNo?.trim() || null,
        refundNo: form.refundNo?.trim() || null,
        ticketNo: form.ticketNo?.trim() || null,
        reason: form.reason?.trim(),
      })
      setForm(initialForm())
      setMessage('异常任务已创建')
      await load(statusFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建异常任务失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">异常任务</h1>
          <p className="mt-2 text-[14px] text-gray-500">集中处理支付、退款、出票、库存等需要人工追踪的后台异常。</p>
        </div>
        <button onClick={() => load(statusFilter)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]">
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-600">
            <ShieldAlert className="h-4 w-4 text-[#dc2626]" />
            待处理任务
          </div>
          <div className="text-[30px] font-bold leading-none text-[#111]">{pendingCount}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-600">
            <AlertTriangle className="h-4 w-4 text-[#f97316]" />
            高优先级
          </div>
          <div className="text-[30px] font-bold leading-none text-[#111]">{highCount}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[14px] font-medium text-gray-600">当前筛选</div>
          <div className="text-[20px] font-bold leading-none text-[#111]">{statusOptions.find(item => item.value === statusFilter)?.label || '全部'}</div>
          <div className="mt-2 text-[12px] text-gray-500">共 {filteredItems.length} 条</div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#111]">
          <Plus className="h-4 w-4 text-[#ff1268]" />
          新建异常任务
        </div>
        <div className="grid gap-3 lg:grid-cols-[160px_120px_1fr_1fr_1fr]">
          <select value={form.taskType} onChange={event => setForm({ ...form, taskType: event.target.value })} className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
            {taskTypeOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={form.severity} onChange={event => setForm({ ...form, severity: event.target.value })} className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
            {severityOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input value={form.businessNo || ''} onChange={event => setForm({ ...form, businessNo: event.target.value })} placeholder="业务编号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.orderNo || ''} onChange={event => setForm({ ...form, orderNo: event.target.value })} placeholder="订单号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.refundNo || ''} onChange={event => setForm({ ...form, refundNo: event.target.value })} placeholder="退款号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <input value={form.paymentNo || ''} onChange={event => setForm({ ...form, paymentNo: event.target.value })} placeholder="支付号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.ticketNo || ''} onChange={event => setForm({ ...form, ticketNo: event.target.value })} placeholder="票号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <button onClick={submit} disabled={saving} className="h-10 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:opacity-60">
            {saving ? '创建中...' : '创建任务'}
          </button>
        </div>
        <textarea value={form.reason || ''} onChange={event => setForm({ ...form, reason: event.target.value })} rows={3} placeholder="异常原因和需要追踪的处理目标" className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]" />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="text-[16px] font-bold text-[#111]">任务队列</div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(item => (
              <button key={item.value} onClick={() => changeStatus(item.value)} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${statusFilter === item.value ? 'bg-[#ff1268] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-16 text-center text-[14px] text-gray-400">正在加载异常任务...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-gray-400">暂无异常任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">关联编号</th>
                  <th className="px-4 py-3 font-medium">等级</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">原因/结果</th>
                  <th className="px-4 py-3 font-medium">TraceId</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="text-[#333]">
                    <td className="px-4 py-3 font-mono text-[12px]">{item.taskType}</td>
                    <td className="px-4 py-3">
                      <div>{item.businessNo || item.orderNo || '-'}</div>
                      <div className="mt-1 text-[12px] text-gray-500">{item.refundNo || item.paymentNo || item.ticketNo || ''}</div>
                    </td>
                    <td className="px-4 py-3">{severityText[item.severity] || item.severity}</td>
                    <td className="px-4 py-3">{statusText[item.status] || item.status}</td>
                    <td className="max-w-[320px] px-4 py-3 text-gray-600">{item.result || item.reason || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-500">{item.traceId || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatTime(item.createTime)}</td>
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
