'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleSlash, Download, Eye, FileSearch, Plus, RefreshCw, X } from 'lucide-react'
import { createReconciliationBatch, getReconciliationBatchDetail, ignoreReconciliationDifference, listReconciliationBatches, resolveReconciliationDifference } from '@/lib/api'
import { globalAlert } from '@/components/GlobalDialog'
import { buildConsoleReconciliationExportCsv, buildConsoleReconciliationExportExcelHtml } from '@/lib/console-reconciliation'
import {
  formatReconciliationBatchStatus,
  formatReconciliationBusinessType,
  formatReconciliationDetailStatus,
  formatReconciliationDifferenceStatus,
  formatReconciliationDiffType,
  formatReconciliationSource,
  formatReconciliationSummaryKey,
} from '@/lib/operation-display'
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
    return Object.entries(parsed).slice(0, 6).map(([key, value]) => ({ key: formatReconciliationSummaryKey(key), value: String(value) }))
  } catch {
    return [{ key: formatReconciliationSummaryKey('summary'), value: summaryJson }]
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
  const [message, setMessage] = useState('')
  const [actingDifferenceId, setActingDifferenceId] = useState<number | null>(null)

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
    setMessage('')
    try {
      const created = await createReconciliationBatch(bizDate)
      await load()
      await handleView(created)
      setMessage('对账批次已生成')
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

  const handleDifferenceAction = async (differenceId: number, action: 'resolve' | 'ignore') => {
    if (!selectedDetail) return
    setError('')
    setDetailError('')
    setMessage('')
    setActingDifferenceId(differenceId)
    try {
      if (action === 'resolve') {
        await resolveReconciliationDifference(selectedDetail.batch.batchNo, differenceId)
        setMessage('对账差异已标记为已处理')
      } else {
        await ignoreReconciliationDifference(selectedDetail.batch.batchNo, differenceId)
        setMessage('对账差异已忽略')
      }
      const refreshed = await getReconciliationBatchDetail(selectedDetail.batch.batchNo)
      setSelectedDetail(refreshed)
      await load()
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '更新对账差异失败')
    } finally {
      setActingDifferenceId(null)
    }
  }

  const downloadSelectedDetail = (content: string, type: string, extension: string) => {
    if (!selectedDetail) return
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `对账单-${selectedDetail.batch.batchNo}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportSelectedDetail = () => {
    if (!selectedDetail) {
      setMessage('请先打开对账批次详情')
      return
    }
    downloadSelectedDetail(buildConsoleReconciliationExportCsv(selectedDetail), 'text/csv;charset=utf-8', 'csv')
    setMessage(`已导出对账单 ${selectedDetail.batch.batchNo}`)
  }

  const exportSelectedDetailExcel = () => {
    if (!selectedDetail) {
      setMessage('请先打开对账批次详情')
      return
    }
    downloadSelectedDetail(buildConsoleReconciliationExportExcelHtml(selectedDetail), 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setMessage(`已导出对账单 Excel ${selectedDetail.batch.batchNo}`)
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
          <div className="mt-2 text-[12px] text-gray-500">{formatReconciliationBatchStatus(latestBatch?.status)}</div>
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

      {(error || message) && <div className={`rounded-xl px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{error || message}</div>}

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
                      <td className="px-4 py-3">{formatReconciliationSource(item.sourceType)}</td>
                      <td className="px-4 py-3">{formatReconciliationBatchStatus(item.status)}</td>
                      <td className="max-w-[360px] px-4 py-3 text-gray-600">
                        {summary.length === 0 ? '-' : summary.map(part => `${part.key}：${part.value}`).join('，')}
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
            <div className="flex items-center gap-2">
              {selectedDetail ? (
                <>
                  <button
                    onClick={exportSelectedDetail}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出对账单
                  </button>
                  <button
                    onClick={exportSelectedDetailExcel}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出 Excel
                  </button>
                </>
              ) : null}
              <button
                onClick={() => { setSelectedDetail(null); setDetailError('') }}
                aria-label="关闭详情"
                title="关闭详情"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#ff1268] hover:text-[#ff1268]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
                  <div className="mt-1 text-[13px] text-[#111]">{formatReconciliationSource(selectedDetail.batch.sourceType)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-500">状态</div>
                  <div className="mt-1 text-[13px] text-[#111]">{formatReconciliationBatchStatus(selectedDetail.batch.status)}</div>
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
                            <td className="px-4 py-3">{formatReconciliationBusinessType(detail.businessType)}</td>
                            <td className="px-4 py-3">{formatAmount(detail.expectedAmount)}</td>
                            <td className="px-4 py-3">{formatAmount(detail.actualAmount)}</td>
                            <td className="px-4 py-3">{formatReconciliationDetailStatus(detail.status)}</td>
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
                          <th className="px-4 py-3 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedDetail.differences.map(diff => (
                          <tr key={diff.id}>
                            <td className="px-4 py-3">{diff.businessNo || '-'}</td>
                            <td className="px-4 py-3">{formatReconciliationDiffType(diff.diffType)}</td>
                            <td className="px-4 py-3">{formatAmount(diff.diffAmount)}</td>
                            <td className="px-4 py-3">{formatReconciliationDifferenceStatus(diff.status)}</td>
                            <td className="max-w-[320px] px-4 py-3 text-gray-600">{diff.reason || '-'}</td>
                            <td className="min-w-[220px] px-4 py-3">
                              {diff.status === 'open' ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleDifferenceAction(diff.id, 'resolve')}
                                    disabled={actingDifferenceId === diff.id}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    标记已处理
                                  </button>
                                  <button
                                    onClick={() => handleDifferenceAction(diff.id, 'ignore')}
                                    disabled={actingDifferenceId === diff.id}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60"
                                  >
                                    <CircleSlash className="h-3.5 w-3.5" />
                                    忽略
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[12px] text-gray-400">已结束</span>
                              )}
                            </td>
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
