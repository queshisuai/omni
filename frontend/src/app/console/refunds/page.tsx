'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Download, XCircle } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { approveRefund, listAdminRefunds, rejectRefund } from '@/lib/api'
import { isPlatformAdminRole } from '@/lib/console-auth'
import {
  buildConsoleRefundExportCsv,
  buildConsoleRefundExportExcelHtml,
  canApplyConsoleRefundReviewAction,
  canReviewConsoleRefund,
  formatConsoleRefundActionLabel,
  formatConsoleRefundStatus,
  getBatchRefundApproveTargets,
  getBatchRefundRejectTargets,
  getConsoleRefundActivityLabel,
  getConsoleRefundStatusClassName,
} from '@/lib/console-refunds'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import type { RefundRequestVO, RefundStatus, UserRole } from '@/types/api'

const STATUS_OPTIONS: Array<{ label: string; value?: RefundStatus }> = [
  { label: '全部' },
  { label: '待审核', value: 0 },
  { label: '处理中', value: 4 },
  { label: '已退款', value: 1 },
  { label: '已拒绝', value: 2 },
  { label: '退款失败', value: 3 },
]

type ReviewAction = 'approve' | 'reject'

interface ReviewDraft {
  id: number
  action: ReviewAction
  note: string
}

function formatMoney(amount: number) {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function formatTime(value: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').substring(0, 19)
}

export default function ConsoleRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequestVO[]>([])
  const [status, setStatus] = useState<RefundStatus | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [page, setPage] = useState(1)
  const [exportMessage, setExportMessage] = useState('')
  const [selectedRefundIds, setSelectedRefundIds] = useState<number[]>([])
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const isAdmin = isPlatformAdminRole(role)
  const pageRefunds = useMemo(() => refunds.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [refunds, page])
  const pageReviewableRefunds = useMemo(() => getBatchRefundApproveTargets(pageRefunds), [pageRefunds])
  const selectedRefunds = useMemo(
    () => refunds.filter(refund => selectedRefundIds.includes(refund.id)),
    [refunds, selectedRefundIds],
  )
  const batchApproveTargets = useMemo(() => getBatchRefundApproveTargets(selectedRefunds), [selectedRefunds])
  const batchRejectTargets = useMemo(() => getBatchRefundRejectTargets(selectedRefunds), [selectedRefunds])
  const allPageReviewableSelected = pageReviewableRefunds.length > 0
    && pageReviewableRefunds.every(refund => selectedRefundIds.includes(refund.id))

  useEffect(() => {
    let ignore = false
    const user = getUser()
    if (user) {
      setRole(user.role || 'user')
      setCheckingRole(false)
    }

    setLoading(true)
    setError('')
    listAdminRefunds(status)
      .then(data => {
        if (!ignore) {
          setRefunds(data)
          setPage(1)
          setSelectedRefundIds([])
        }
      })
      .catch(() => {
        if (!ignore) setError('加载退款申请失败，请稍后重试')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [status])

  const refresh = async () => {
    setError('')
    setExportMessage('')
    const data = await listAdminRefunds(status)
    setRefunds(data)
    setPage(1)
    setSelectedRefundIds([])
  }

  const startReview = (refund: RefundRequestVO, action: ReviewAction) => {
    if (!canApplyConsoleRefundReviewAction(refund.status, action)) {
      setError('退款状态待核对，请刷新后再操作')
      return
    }
    setError('')
    setDraft({ id: refund.id, action, note: '' })
  }

  const submitReview = async () => {
    if (!draft) return
    const currentRefund = refunds.find(refund => refund.id === draft.id)
    if (!currentRefund || !canApplyConsoleRefundReviewAction(currentRefund.status, draft.action)) {
      setError('退款状态待核对，请刷新后再操作')
      setDraft(null)
      return
    }
    const note = draft.note.trim() || undefined
    setSubmittingId(draft.id)
    setError('')
    try {
      if (draft.action === 'approve') {
        await approveRefund(draft.id, note)
      } else {
        await rejectRefund(draft.id, note)
      }
      setDraft(null)
      await refresh()
    } catch {
      setError('提交审核失败，请稍后重试')
    } finally {
      setSubmittingId(null)
    }
  }

  const toggleRefundSelection = (refund: RefundRequestVO) => {
    if (!canReviewConsoleRefund(refund.status) || batchSubmitting) return
    setSelectedRefundIds(previous => previous.includes(refund.id)
      ? previous.filter(id => id !== refund.id)
      : [...previous, refund.id])
  }

  const togglePageSelection = () => {
    if (batchSubmitting) return
    const pageIds = pageReviewableRefunds.map(refund => refund.id)
    setSelectedRefundIds(previous => {
      if (allPageReviewableSelected) {
        return previous.filter(id => !pageIds.includes(id))
      }
      return Array.from(new Set([...previous, ...pageIds]))
    })
  }

  const handleBatchRefundReview = async (action: ReviewAction) => {
    const targets = action === 'approve' ? batchApproveTargets : batchRejectTargets
    if (targets.length === 0) {
      setError(action === 'approve' ? '请先选择可同意或重试的退款申请' : '请先选择待审核的退款申请')
      return
    }

    const actionName = action === 'approve' ? '批量同意/重试退款' : '批量拒绝退款'
    const confirmed = window.confirm(`确认${actionName} ${targets.length} 条退款申请？该操作会逐条调用现有审核链路并写入对应审计。`)
    if (!confirmed) return

    setBatchSubmitting(true)
    setError('')
    setExportMessage('')
    let successCount = 0
    let failedCount = 0

    for (const refund of targets) {
      try {
        if (action === 'approve') {
          await approveRefund(refund.id, '批量同意/重试退款')
        } else {
          await rejectRefund(refund.id, '批量拒绝退款')
        }
        successCount += 1
      } catch {
        failedCount += 1
      }
    }

    try {
      await refresh()
      setExportMessage(`批量处理结果：成功 ${successCount} 条，失败 ${failedCount} 条`)
      if (failedCount > 0) {
        setError(`批量处理有 ${failedCount} 条失败，请刷新后核对退款状态`)
      }
    } catch {
      setError('批量处理已提交，但刷新列表失败，请手动刷新核对')
    } finally {
      setBatchSubmitting(false)
    }
  }

  const downloadRefunds = (content: string, type: string, extension: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `退款明细-${new Date().toISOString().slice(0, 10)}.${extension}`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportRefunds = () => {
    if (refunds.length === 0) {
      setExportMessage('暂无可导出的退款申请')
      return
    }
    downloadRefunds(buildConsoleRefundExportCsv(refunds), 'text/csv;charset=utf-8', 'csv')
    setExportMessage(`已导出 ${refunds.length} 条退款申请`)
  }

  const exportRefundsExcel = () => {
    if (refunds.length === 0) {
      setExportMessage('暂无可导出的退款申请')
      return
    }
    downloadRefunds(buildConsoleRefundExportExcelHtml(refunds), 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setExportMessage(`已导出 ${refunds.length} 条退款 Excel 明细`)
  }

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '退款审核' : '主办方退款处理'}</h1>
          <div className="text-[13px] text-[#999] mt-1">{isAdmin ? '审核可见范围内的退款申请，处理中记录可重试退款' : '处理自己活动相关的退款申请，处理中记录可重试退款'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportRefunds}
            disabled={loading || refunds.length === 0}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#fff5f8] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <Download className="h-4 w-4" />
            导出退款明细
          </button>
          <button
            onClick={exportRefundsExcel}
            disabled={loading || refunds.length === 0}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#fff5f8] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <Download className="h-4 w-4" />
            导出 Excel
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="self-start sm:self-auto text-[14px] text-[#ff1268] bg-white border border-[#ffd1e0] px-4 py-2 rounded-lg cursor-pointer hover:bg-[#fff5f8] disabled:text-[#bbb] disabled:cursor-not-allowed"
          >
            刷新列表
          </button>
        </div>
      </div>

      {exportMessage && <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{exportMessage}</div>}

      <div className="bg-white rounded-xl border border-[#e5e5e5] p-3 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {STATUS_OPTIONS.map(option => {
            const active = status === option.value
            return (
              <button
                key={option.label}
                onClick={() => setStatus(option.value)}
                className={`px-3 py-1.5 rounded-full text-[13px] border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#ff1268] text-white border-[#ff1268]'
                    : 'bg-white text-[#666] border-[#e5e5e5] hover:border-[#ff1268] hover:text-[#ff1268]'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {refunds.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-[#666]">
            已选择 {selectedRefundIds.length} 条，可批量处理 {batchApproveTargets.length} 条；处理中退款仅支持同意/重试，不支持批量拒绝。
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBatchRefundReview('approve')}
              disabled={batchSubmitting || batchApproveTargets.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#e0105a] disabled:cursor-not-allowed disabled:bg-[#f8a9c6]"
            >
              <CheckSquare className="h-4 w-4" />
              {batchSubmitting ? '批量处理中...' : '批量同意退款'}
            </button>
            <button
              onClick={() => handleBatchRefundReview('reject')}
              disabled={batchSubmitting || batchRejectTargets.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 py-2 text-[14px] font-medium text-[#666] hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              批量拒绝退款
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[#e11d48] bg-[#fff1f2] border border-[#fecdd3] rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-[#999] py-20">加载中...</div>
      ) : refunds.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无退款申请
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-[14px]">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                  <th className="w-[52px] p-3 text-left font-medium text-[#666]">
                    <input
                      type="checkbox"
                      aria-label="选择本页可处理退款"
                      checked={allPageReviewableSelected}
                      disabled={batchSubmitting || pageReviewableRefunds.length === 0}
                      onChange={togglePageSelection}
                      className="h-4 w-4 accent-[#ff1268]"
                    />
                  </th>
                  <th className="text-left p-3 font-medium text-[#666]">退款号</th>
                  <th className="text-left p-3 font-medium text-[#666]">订单/活动</th>
                  <th className="text-left p-3 font-medium text-[#666]">用户编号</th>
                  <th className="text-left p-3 font-medium text-[#666]">金额</th>
                  <th className="text-left p-3 font-medium text-[#666]">原因</th>
                  <th className="text-left p-3 font-medium text-[#666]">状态</th>
                  <th className="text-left p-3 font-medium text-[#666]">申请时间</th>
                  <th className="text-left p-3 font-medium text-[#666]">审核备注/时间</th>
                  <th className="text-left p-3 font-medium text-[#666]">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRefunds.map(refund => {
                  const statusLabel = formatConsoleRefundStatus(refund.status)
                  const statusClassName = getConsoleRefundStatusClassName(refund.status)
                  const canReview = canReviewConsoleRefund(refund.status)
                  const actionLabel = formatConsoleRefundActionLabel(refund.status)
                  const reviewing = draft?.id === refund.id
                  const submitting = submittingId === refund.id
                  const selected = selectedRefundIds.includes(refund.id)
                  return (
                    <tr key={refund.id} className="border-b border-[#f0f0f0] align-top hover:bg-[#fafafa]">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`选择退款 ${refund.refundNo || refund.id}`}
                          checked={selected}
                          disabled={!canReview || batchSubmitting}
                          onChange={() => toggleRefundSelection(refund)}
                          className="h-4 w-4 accent-[#ff1268] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-3 font-medium text-[#333]">{refund.refundNo || refund.id}</td>
                      <td className="p-3 text-[#666]">
                        <div className="font-medium text-[#333]">{getConsoleRefundActivityLabel(refund)}</div>
                        <div className="text-[12px] text-[#666]">订单号：{refund.orderNo || '-'}</div>
                        <div className="text-[12px] text-[#999]">订单编号：{refund.orderId}</div>
                      </td>
                      <td className="p-3 text-[#666]">{refund.userId}</td>
                      <td className="p-3 text-[#ff1268] font-medium">{formatMoney(refund.amount)}</td>
                      <td className="p-3 text-[#666] max-w-[180px] whitespace-pre-wrap break-words">{refund.reason || '-'}</td>
                      <td className="p-3">
                        <span className={`text-[12px] px-2 py-0.5 rounded-full ${statusClassName}`}>{statusLabel}</span>
                      </td>
                      <td className="p-3 text-[#999] whitespace-nowrap">{formatTime(refund.createTime)}</td>
                      <td className="p-3 text-[#666] max-w-[220px]">
                        <div className="whitespace-pre-wrap break-words">{refund.reviewNote || '-'}</div>
                        <div className="text-[12px] text-[#999] mt-1">{formatTime(refund.reviewTime)}</div>
                      </td>
                      <td className="p-3 min-w-[210px]">
                        {canReview && !reviewing && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startReview(refund, 'approve')}
                              className="text-[13px] bg-[#ff1268] text-white px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-[#e0105a]"
                            >
                              {refund.status === 4 ? '重试退款' : '同意退款'}
                            </button>
                            {refund.status === 0 && (
                              <button
                                onClick={() => startReview(refund, 'reject')}
                                className="text-[13px] bg-white text-[#666] border border-[#ddd] px-3 py-1.5 rounded-lg cursor-pointer hover:border-[#ff1268] hover:text-[#ff1268]"
                              >
                                拒绝退款
                              </button>
                            )}
                          </div>
                        )}
                        {canReview && reviewing && (
                          <div className="w-[260px] max-w-full">
                            <textarea
                              value={draft.note}
                              onChange={e => setDraft({ ...draft, note: e.target.value })}
                              rows={3}
                              placeholder={refund.status === 4 ? '重试备注，可空' : '审核备注，可空'}
                              className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[13px] outline-none resize-none focus:border-[#ff1268]"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={submitReview}
                                disabled={submitting}
                                className="text-[13px] bg-[#ff1268] text-white px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-[#e0105a] disabled:bg-[#f8a9c6] disabled:cursor-not-allowed"
                              >
                                {submitting ? '提交中...' : draft.action === 'approve' ? refund.status === 4 ? '确认重试' : '确认同意' : '确认拒绝'}
                              </button>
                              <button
                                onClick={() => setDraft(null)}
                                disabled={submitting}
                                className="text-[13px] text-[#666] bg-transparent border-none cursor-pointer hover:text-[#333] disabled:text-[#bbb]"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        )}
                        {!canReview && (
                          <div className="text-[13px] text-[#999]">{actionLabel}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <GlobalPagination page={page} total={refunds.length} loading={loading} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
