'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Download, XCircle } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { approveRefund, batchReviewRefunds, listAdminRefunds, rejectRefund } from '@/lib/api'
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
import { Modal } from '@/components/ui/Modal'
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

interface RefundReviewDialog {
  action: ReviewAction
  scope: 'single' | 'batch'
  ids: number[]
  note: string
  title: string
  description: string
}

function formatMoney(amount: number) {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function formatTime(value: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').substring(0, 19)
}

function shouldShowTooltip(value: string | null | undefined, limit: number) {
  return Boolean(value && value.length > limit)
}

export default function ConsoleRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequestVO[]>([])
  const [status, setStatus] = useState<RefundStatus | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refundReviewDialog, setRefundReviewDialog] = useState<RefundReviewDialog | null>(null)
  const [reviewDialogError, setReviewDialogError] = useState('')
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
    setReviewDialogError('')
    setRefundReviewDialog({
      action,
      scope: 'single',
      ids: [refund.id],
      note: '',
      title: action === 'approve' ? (refund.status === 4 ? '重试退款' : '同意退款') : '拒绝退款申请',
      description: action === 'approve'
        ? `确认${refund.status === 4 ? '重试' : '同意'}退款申请“${refund.refundNo || refund.id}”？审核备注可选。`
        : `确认拒绝退款申请“${refund.refundNo || refund.id}”？请填写拒绝原因。`,
    })
  }

  const submitReview = async () => {
    if (!refundReviewDialog) return
    const note = refundReviewDialog.note.trim()
    if (refundReviewDialog.action === 'reject' && !note) {
      setReviewDialogError('拒绝原因不能为空')
      return
    }

    setError('')
    setReviewDialogError('')
    try {
      let batchOutcome = ''
      let batchError = ''
      if (refundReviewDialog.scope === 'single') {
        const [id] = refundReviewDialog.ids
        const currentRefund = refunds.find(refund => refund.id === id)
        if (!currentRefund || !canApplyConsoleRefundReviewAction(currentRefund.status, refundReviewDialog.action)) {
          setError('退款状态待核对，请刷新后再操作')
          setRefundReviewDialog(null)
          return
        }
        setSubmittingId(id)
        if (refundReviewDialog.action === 'approve') {
          await approveRefund(id, note || undefined)
        } else {
          await rejectRefund(id, note)
        }
      } else {
        const selectedTargets = refunds.filter(refund => refundReviewDialog.ids.includes(refund.id))
        const targets = refundReviewDialog.action === 'approve'
          ? getBatchRefundApproveTargets(selectedTargets)
          : getBatchRefundRejectTargets(selectedTargets)
        if (targets.length === 0) {
          setError(refundReviewDialog.action === 'approve' ? '请先选择可同意或重试的退款申请' : '请先选择待审核的退款申请')
          setRefundReviewDialog(null)
          return
        }

        setBatchSubmitting(true)
        await batchReviewRefunds(
          targets.map(refund => refund.id),
          refundReviewDialog.action === 'approve' ? 'APPROVE' : 'REJECT',
          note || '批量同意/重试退款',
        )
        batchOutcome = `批量审核已提交 ${targets.length} 条`
      }
      setRefundReviewDialog(null)
      await refresh()
      if (batchOutcome) setExportMessage(batchOutcome)
      if (batchError) setError(batchError)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交审核失败，请稍后重试')
    } finally {
      setSubmittingId(null)
      setBatchSubmitting(false)
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

    setError('')
    setReviewDialogError('')
    setExportMessage('')
    const actionName = action === 'approve' ? '批量同意/重试退款' : '批量拒绝退款'
    setRefundReviewDialog({
      action,
      scope: 'batch',
      ids: targets.map(refund => refund.id),
      note: '',
      title: actionName,
      description: `确认${actionName} ${targets.length} 条退款申请？该操作将通过原子批量接口提交，避免局部成功造成账务不一致。${action === 'reject' ? '请填写拒绝原因。' : '审核备注可选。'}`,
    })
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

      <div className="bg-white rounded-xl border border-[#e5e5e5] p-3 mb-4">
        <div className="flex flex-wrap gap-2">
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
          <table className="w-full table-fixed text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="w-[160px] py-3 pl-4 pr-2 text-left font-medium text-[#666]">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="选择本页可处理退款"
                      checked={allPageReviewableSelected}
                      disabled={batchSubmitting || pageReviewableRefunds.length === 0}
                      onChange={togglePageSelection}
                      className="h-4 w-4 shrink-0 accent-[#ff1268]"
                    />
                    <span className="truncate">单号与用户</span>
                  </div>
                </th>
                <th className="w-[180px] px-2 py-3 text-left font-medium text-[#666]">演出活动</th>
                <th className="w-[90px] px-2 py-3 pr-4 text-right font-medium text-[#666]">退款金额</th>
                <th className="w-[180px] px-2 py-3 text-left font-medium text-[#666]">申请原因</th>
                <th className="w-[110px] px-2 py-3 text-center font-medium text-[#666]">状态与批注</th>
                <th className="w-[160px] px-2 py-3 text-left font-medium text-[#666]">时间记录</th>
                <th className="w-[140px] px-2 py-3 pr-4 text-right font-medium text-[#666]">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRefunds.map(refund => {
                const statusLabel = formatConsoleRefundStatus(refund.status)
                const statusClassName = getConsoleRefundStatusClassName(refund.status)
                const canReview = canReviewConsoleRefund(refund.status)
                const actionLabel = formatConsoleRefundActionLabel(refund.status)
                const selected = selectedRefundIds.includes(refund.id)
                const refundNo = refund.refundNo || String(refund.id)
                const orderNo = refund.orderNo || '-'
                const activityLabel = getConsoleRefundActivityLabel(refund)
                return (
                  <tr key={refund.id} className="border-b border-[#f0f0f0] align-middle hover:bg-[#fafafa]">
                    <td className="w-[160px] py-3 pl-4 pr-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`选择退款 ${refundNo}`}
                          checked={selected}
                          disabled={!canReview || batchSubmitting}
                          onChange={() => toggleRefundSelection(refund)}
                          className="h-4 w-4 shrink-0 accent-[#ff1268] disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="truncate font-mono text-xs font-semibold text-gray-800" title={refundNo}>
                            {refundNo}
                          </span>
                          <span className="truncate font-mono text-[11px] text-gray-400" title={`订单: ${orderNo} | 用户ID: ${refund.userId}`}>
                            {orderNo} · UID: {refund.userId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="w-[180px] px-2 py-3">
                      <div className="truncate text-xs font-medium text-gray-800" title={activityLabel}>
                        {activityLabel}
                      </div>
                    </td>
                    <td className="w-[90px] px-2 py-3 pr-4 text-right font-semibold text-[#ff1268] whitespace-nowrap">{formatMoney(refund.amount)}</td>
                    <td className="w-[180px] px-2 py-3">
                      <div className="relative group max-w-[170px]">
                        <p className="truncate text-xs text-gray-600 cursor-help">
                          {refund.reason || '无申请原因'}
                        </p>
                        {refund.reason && (
                          <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-max max-w-xs rounded-lg bg-gray-900/95 p-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-xs transition-all group-hover:block">
                            {refund.reason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="w-[110px] px-2 py-3 text-center">
                      <div className="relative group inline-block">
                        <span className={`cursor-help rounded-full px-2 py-0.5 text-[12px] ${statusClassName}`}>{statusLabel}</span>
                        {refund.reviewNote && (
                          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden w-max max-w-[200px] -translate-x-1/2 rounded bg-gray-800 p-1.5 text-[11px] leading-relaxed text-white shadow-lg group-hover:block">
                            审核备注：{refund.reviewNote}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="w-[160px] px-2 py-3">
                      <div className="font-mono text-xs text-gray-600">{formatTime(refund.createTime)}</div>
                      <div className="mt-1 font-mono text-[11px] text-gray-400">{formatTime(refund.reviewTime)}</div>
                    </td>
                    <td className="w-[140px] px-2 py-3 pr-4 text-right align-middle whitespace-nowrap">
                      {canReview && (
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => startReview(refund, 'approve')}
                            className="rounded-lg border-none bg-[#ff1268] px-2.5 py-1.5 text-[12px] text-white cursor-pointer hover:bg-[#e0105a]"
                          >
                            {refund.status === 4 ? '重试' : '同意'}
                          </button>
                          {refund.status === 0 && (
                            <button
                              onClick={() => startReview(refund, 'reject')}
                              className="rounded-lg border border-[#f53f3f] bg-white px-2.5 py-1.5 text-[12px] text-[#f53f3f] cursor-pointer hover:bg-[#fff1f2]"
                            >
                              拒绝
                            </button>
                          )}
                        </div>
                      )}
                      {!canReview && (
                        <div className="text-right text-[13px] text-[#999]">{actionLabel === '无需操作' ? '已完结' : actionLabel}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <GlobalPagination page={page} total={refunds.length} loading={loading} onChange={setPage} />
          </div>
        </div>
      )}

      <Modal
        open={Boolean(refundReviewDialog)}
        onClose={() => {
          if (submittingId || batchSubmitting) return
          setRefundReviewDialog(null)
          setReviewDialogError('')
        }}
        title={refundReviewDialog?.title || '退款审核'}
        size="md"
        danger={refundReviewDialog?.action === 'reject'}
        loading={Boolean(submittingId) || batchSubmitting}
        footer={(
          <>
            <button
              type="button"
              onClick={() => {
                if (submittingId || batchSubmitting) return
                setRefundReviewDialog(null)
                setReviewDialogError('')
              }}
              disabled={Boolean(submittingId) || batchSubmitting}
              className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitReview}
              disabled={Boolean(submittingId) || batchSubmitting}
              className={`rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${refundReviewDialog?.action === 'reject' ? 'bg-[#f53f3f] hover:bg-[#d92d2d]' : 'bg-[#ff1268] hover:bg-[#e0105a]'}`}
            >
              {submittingId || batchSubmitting ? '提交中...' : refundReviewDialog?.action === 'reject' ? '确认拒绝' : '确认同意'}
            </button>
          </>
        )}
      >
        {refundReviewDialog ? (
          <div className="space-y-4">
            <p className="text-[14px] leading-6 text-[#666]">{refundReviewDialog.description}</p>
            <label className="block text-[13px] font-medium text-[#333]">
              {refundReviewDialog.action === 'reject' ? '拒绝原因 *' : '审核备注'}
              <textarea
                value={refundReviewDialog.note}
                onChange={event => {
                  setRefundReviewDialog({ ...refundReviewDialog, note: event.target.value })
                  if (event.target.value.trim()) setReviewDialogError('')
                }}
                rows={4}
                placeholder={refundReviewDialog.action === 'reject' ? '请输入拒绝原因（必填）' : '请输入审核备注（可选）'}
                className={`mt-1 w-full resize-none rounded-xl border p-3 text-[14px] outline-none ${reviewDialogError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
            </label>
            {reviewDialogError && <div className="text-[13px] text-[#dc2626]">{reviewDialogError}</div>}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
