'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, FileSearch, Plus, RefreshCw, X } from 'lucide-react'
import { createReconciliationBatch, getReconciliationBatchDetail, listReconciliationBatches } from '@/lib/api'
import { globalAlert } from '@/components/GlobalDialog'
import type { ReconciliationBatchDetailVO, ReconciliationBatchVO } from '@/types/api'

function todayText() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function formatStatus(status?: string | null) {
  if (status === 'generated') return '已生成'
  if (status === 'processing') return '处理中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return status || '-'
}

function formatDetailStatus(status?: string | null) {
  if (status === 'matched') return '已匹配'
  if (status === 'unmatched') return '未匹配'
  if (status === 'pending') return '待处理'
  return status || '-'
}

function formatDifferenceStatus(status?: string | null) {
  if (status === 'open') return '待处理'
  if (status === 'resolved') return '已处理'
  if (status === 'ignored') return '已忽略'
  return status || '-'
}

function formatSource(source?: string | null) {
  if (source === 'local') return '本地日结'
  if (source === 'alipay') return '支付宝'
  return source || '-'
}

function formatBusinessType(type?: string | null) {
  if (type === 'payment') return '支付'
  if (type === 'refund') return '退款'
  if (type === 'ticket') return '票务'
  if (type === 'summary') return '汇总'
  return type || '-'
}

function formatDiffType(type?: string | null) {
  if (type === 'amount_mismatch') return '金额不一致'
  if (type === 'missing_local') return '本地缺失'
  if (type === 'missing_channel') return '渠道缺失'
  if (type === 'status_mismatch') return '状态不一致'
  return type || '-'
}

function formatAmount(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-'
  const amount = Number(value)
  if (Number.isNaN(amount)) return String(value)
  return amount.toFixed(2)
}

function parseSummary(summaryJson?: string | null) {
  if (!summaryJson) return []
  try {
    const parsed = JSON.parse(summaryJson) as Record<string, unknown>
    return Object.entries(parsed).slice(0, 6).map(([key, value]) => ({ key, value: String(value) }))
  } catch {
    return [{ key: 'summary', value: summaryJson }]
  }
}

export default function ReconciliationPage() {
  const [items, setItems] = useState<ReconciliationBatchVO[]>([])
  const [bizDate, setBizDate] = useState(todayText())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<ReconciliationBatchDetailVO | null>(null)
  const [detailError, setDetailError] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listReconciliationBatches())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载对账批次失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const latestBatch = items[0] || null
  const statusSummary = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})
  }, [items])

  const handleCreate = async () => {
    if (!bizDate) {
      await globalAlert('请选择对账日期')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createReconciliationBatch(bizDate)
      await load()
      await handleView(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成对账批次失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleView = async (item: ReconciliationBatchVO) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      setSelectedDetail(await getReconciliationBatchDetail(item.batchNo))
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '加载对账批次详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">日结对账</h1>
          <p className="mt-2 text-[14px] text-gray-500">按业务日期生成日结批次，跟踪支付、退款和差异处理的后台对账结果。</p>
        </div>
        <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]">
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-gray-600">
            <FileSearch className="h-4 w-4 text-[#2563eb]" />
            对账批次
          </div>
          <div className="text-[30px] font-bold leading-none text-[#111]">{items.length}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[14px] font-medium text-gray-600">最近日期</div>
          <div className="text-[20px] font-bold leading-none text-[#111]">{latestBatch?.bizDate || '-'}</div>
          <div className="mt-2 text-[12px] text-gray-500">{formatStatus(latestBatch?.status)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[14px] font-medium text-gray-600">已生成</div>
          <div className="text-[30px] font-bold leading-none text-[#111]">{statusSummary.generated || 0}</div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#111]">
          <Plus className="h-4 w-4 text-[#ff1268]" />
          生成日结批次
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={bizDate}
            onChange={event => setBizDate(event.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-[#ff1268]"
          />
          <button onClick={handleCreate} disabled={submitting} className="h-10 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:opacity-60">
            {submitting ? '生成中...' : '生成批次'}
          </button>
        </div>
      </section>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-500">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">批次列表</div>
        {loading ? (
          <div className="py-16 text-center text-[14px] text-gray-400">正在加载对账批次...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-gray-400">暂无对账批次</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">批次号</th>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">摘要</th>
                  <th className="px-4 py-3 font-medium">生成时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => {
                  const summary = parseSummary(item.summaryJson)
                  return (
                    <tr key={item.id} className="text-[#333]">
                      <td className="px-4 py-3 font-mono text-[12px]">{item.batchNo}</td>
                      <td className="px-4 py-3">{item.bizDate}</td>
                      <td className="px-4 py-3">{formatSource(item.sourceType)}</td>
                      <td className="px-4 py-3">{formatStatus(item.status)}</td>
                      <td className="max-w-[360px] px-4 py-3 text-gray-600">
                        {summary.length === 0 ? '-' : summary.map(part => `${part.key}: ${part.value}`).join('，')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTime(item.createTime)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleView(item)}
                          disabled={detailLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(selectedDetail || detailLoading || detailError) && (
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="text-[16px] font-bold text-[#111]">批次详情</div>
            <button
              onClick={() => { setSelectedDetail(null); setDetailError('') }}
              aria-label="关闭详情"
              title="关闭详情"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#ff1268] hover:text-[#ff1268]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {detailLoading ? (
            <div className="py-12 text-center text-[14px] text-gray-400">正在加载批次详情...</div>
          ) : detailError ? (
            <div className="m-5 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-500">{detailError}</div>
          ) : selectedDetail ? (
            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[12px] text-gray-500">批次号</div>
                  <div className="mt-1 font-mono text-[13px] text-[#111]">{selectedDetail.batch.batchNo}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-500">日期</div>
                  <div className="mt-1 text-[13px] text-[#111]">{selectedDetail.batch.bizDate}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-500">来源</div>
                  <div className="mt-1 text-[13px] text-[#111]">{formatSource(selectedDetail.batch.sourceType)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-500">状态</div>
                  <div className="mt-1 text-[13px] text-[#111]">{formatStatus(selectedDetail.batch.status)}</div>
                </div>
              </div>

              <div>
                <div className="mb-3 text-[14px] font-bold text-[#111]">对账明细</div>
                {selectedDetail.details.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 py-8 text-center text-[13px] text-gray-400">暂无对账明细</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-full text-left text-[13px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">业务号</th>
                          <th className="px-4 py-3 font-medium">类型</th>
                          <th className="px-4 py-3 font-medium">应收/应退</th>
                          <th className="px-4 py-3 font-medium">实收/实退</th>
                          <th className="px-4 py-3 font-medium">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedDetail.details.map(detail => (
                          <tr key={detail.id}>
                            <td className="px-4 py-3">{detail.businessNo}</td>
                            <td className="px-4 py-3">{formatBusinessType(detail.businessType)}</td>
                            <td className="px-4 py-3">{formatAmount(detail.expectedAmount)}</td>
                            <td className="px-4 py-3">{formatAmount(detail.actualAmount)}</td>
                            <td className="px-4 py-3">{formatDetailStatus(detail.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 text-[14px] font-bold text-[#111]">差异记录</div>
                {selectedDetail.differences.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 py-8 text-center text-[13px] text-gray-400">暂无差异记录</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-full text-left text-[13px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">业务号</th>
                          <th className="px-4 py-3 font-medium">差异类型</th>
                          <th className="px-4 py-3 font-medium">差异金额</th>
                          <th className="px-4 py-3 font-medium">状态</th>
                          <th className="px-4 py-3 font-medium">原因</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedDetail.differences.map(diff => (
                          <tr key={diff.id}>
                            <td className="px-4 py-3">{diff.businessNo || '-'}</td>
                            <td className="px-4 py-3">{formatDiffType(diff.diffType)}</td>
                            <td className="px-4 py-3">{formatAmount(diff.diffAmount)}</td>
                            <td className="px-4 py-3">{formatDifferenceStatus(diff.status)}</td>
                            <td className="max-w-[320px] px-4 py-3 text-gray-600">{diff.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
