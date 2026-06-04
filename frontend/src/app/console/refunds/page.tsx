'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUser } from '@/lib/auth'
import { approveRefund, listAdminRefunds, rejectRefund } from '@/lib/api'
import { isPlatformAdminRole } from '@/lib/console-auth'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/Pagination'
import type { RefundRequestVO, RefundStatus, UserRole } from '@/types/api'

const STATUS_OPTIONS: Array<{ label: string; value?: RefundStatus }> = [
  { label: '全部' },
  { label: '待审核', value: 0 },
  { label: '处理中', value: 4 },
  { label: '已退款', value: 1 },
  { label: '已拒绝', value: 2 },
  { label: '退款失败', value: 3 },
]

const STATUS_META: Record<RefundStatus, { label: string; className: string }> = {
  0: { label: '待审核', className: 'bg-[#fff8e1] text-[#f59e0b]' },
  1: { label: '已退款', className: 'bg-[#f0fff4] text-[#22c55e]' },
  2: { label: '已拒绝', className: 'bg-[#f5f5f5] text-[#777]' },
  3: { label: '退款失败', className: 'bg-[#fff1f2] text-[#e11d48]' },
  4: { label: '处理中', className: 'bg-[#e3f2fd] text-[#2563eb]' },
}

const UNKNOWN_STATUS_META = { label: '未知状态', className: 'bg-[#f5f5f5] text-[#777]' }

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
  const isAdmin = isPlatformAdminRole(role)
  const pageRefunds = useMemo(() => refunds.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [refunds, page])

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
    const data = await listAdminRefunds(status)
    setRefunds(data)
    setPage(1)
  }

  const startReview = (id: number, action: ReviewAction) => {
    setDraft({ id, action, note: '' })
  }

  const submitReview = async () => {
    if (!draft) return
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
        <button
          onClick={refresh}
          disabled={loading}
          className="self-start sm:self-auto text-[14px] text-[#ff1268] bg-white border border-[#ffd1e0] px-4 py-2 rounded-lg cursor-pointer hover:bg-[#fff5f8] disabled:text-[#bbb] disabled:cursor-not-allowed"
        >
          刷新列表
        </button>
      </div>

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
                  <th className="text-left p-3 font-medium text-[#666]">退款号</th>
                  <th className="text-left p-3 font-medium text-[#666]">订单/活动</th>
                  <th className="text-left p-3 font-medium text-[#666]">用户ID</th>
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
                  const meta = STATUS_META[refund.status] || UNKNOWN_STATUS_META
                  const reviewing = draft?.id === refund.id
                  const submitting = submittingId === refund.id
                  return (
                    <tr key={refund.id} className="border-b border-[#f0f0f0] align-top hover:bg-[#fafafa]">
                      <td className="p-3 font-medium text-[#333]">{refund.refundNo || refund.id}</td>
                      <td className="p-3 text-[#666]">
                        <div className="font-medium text-[#333]">{refund.orderName || refund.activityName || '未知活动'}</div>
                        <div className="text-[12px] text-[#666]">订单号：{refund.orderNo || '-'}</div>
                        <div className="text-[12px] text-[#999]">ID: {refund.orderId}</div>
                      </td>
                      <td className="p-3 text-[#666]">{refund.userId}</td>
                      <td className="p-3 text-[#ff1268] font-medium">{formatMoney(refund.amount)}</td>
                      <td className="p-3 text-[#666] max-w-[180px] whitespace-pre-wrap break-words">{refund.reason || '-'}</td>
                      <td className="p-3">
                        <span className={`text-[12px] px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td className="p-3 text-[#999] whitespace-nowrap">{formatTime(refund.createTime)}</td>
                      <td className="p-3 text-[#666] max-w-[220px]">
                        <div className="whitespace-pre-wrap break-words">{refund.reviewNote || '-'}</div>
                        <div className="text-[12px] text-[#999] mt-1">{formatTime(refund.reviewTime)}</div>
                      </td>
                      <td className="p-3 min-w-[210px]">
                        {(refund.status === 0 || refund.status === 4) && !reviewing && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startReview(refund.id, 'approve')}
                              className="text-[13px] bg-[#ff1268] text-white px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-[#e0105a]"
                            >
                              {refund.status === 4 ? '重试退款' : '同意退款'}
                            </button>
                            {refund.status === 0 && (
                              <button
                                onClick={() => startReview(refund.id, 'reject')}
                                className="text-[13px] bg-white text-[#666] border border-[#ddd] px-3 py-1.5 rounded-lg cursor-pointer hover:border-[#ff1268] hover:text-[#ff1268]"
                              >
                                拒绝退款
                              </button>
                            )}
                          </div>
                        )}
                        {(refund.status === 0 || refund.status === 4) && reviewing && (
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
                        {refund.status !== 0 && refund.status !== 4 && (
                          <div className="text-[13px] text-[#999]">无需操作</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} total={refunds.length} loading={loading} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
