'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminRiskCases, reviewActivityRiskResolution } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ActivityRiskCaseVO } from '@/types/api'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_response: { label: '待主办方处理', color: '#6b7280', bg: '#f3f4f6' },
  pending: { label: '待平台审核', color: '#b45309', bg: '#fffbeb' },
  approved: { label: '已通过', color: '#15803d', bg: '#f0fdf4' },
  rejected: { label: '已驳回', color: '#b91c1c', bg: '#fef2f2' },
}

function getRiskCaseStatusMeta(status: string) {
  return STATUS_META[status] || { label: '未知审核状态', color: '#6b7280', bg: '#f3f4f6' }
}

function isKnownRiskCaseStatus(status: string) {
  return Object.prototype.hasOwnProperty.call(STATUS_META, status)
}

function formatRiskCaseActionLabel(status: string) {
  if (status === 'awaiting_response') return '等待主办方处理'
  if (!isKnownRiskCaseStatus(status)) return '状态待核对'
  return ''
}

function getRiskCaseActionClassName(status: string) {
  if (!isKnownRiskCaseStatus(status)) return 'rounded-lg border border-[#ffd591] bg-[#fff7e6] px-4 py-2 text-[13px] text-[#ad6800]'
  return 'rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] text-[#666]'
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface RiskCaseDialog {
  item: ActivityRiskCaseVO
  note: string
}

export default function RiskCasesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cases, setCases] = useState<ActivityRiskCaseVO[]>([])
  const [filter, setFilter] = useState<'all' | 'awaiting_response' | 'pending' | 'approved' | 'rejected'>('all')
  const [riskCaseDialog, setRiskCaseDialog] = useState<RiskCaseDialog | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
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

  const openRiskCaseDialog = (item: ActivityRiskCaseVO) => {
    setRiskCaseDialog({ item, note: '' })
    setReviewError('')
  }

  const submitRiskCaseReview = async (action: 'approve' | 'reject') => {
    if (!riskCaseDialog) return
    const resolutionId = riskCaseDialog.item.latestResolutionId
    if (!resolutionId) {
      setReviewError('恢复审核记录不存在，请刷新后再操作')
      return
    }
    const note = riskCaseDialog.note.trim()
    if (action === 'reject' && !note) {
      setReviewError('驳回原因不能为空')
      return
    }
    const user = getUser()
    if (!user) {
      setReviewError('登录已失效，请重新登录')
      return
    }
    setProcessingId(resolutionId)
    setReviewError('')
    try {
      await reviewActivityRiskResolution(resolutionId, {
        userId: user.userId,
        action,
        reviewNote: note || null,
      })
      setRiskCaseDialog(null)
      await load()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '恢复售票审核失败')
    } finally {
      setProcessingId(null)
    }
  }

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
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left text-[13px]">
              <thead className="bg-[#fafafa] text-[#666]">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">演出活动</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">受牵连艺人</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">停售时间</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">风险触发原因</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">恢复进展</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {pageVisible.map(item => {
                  const status = item.latestResolutionStatus || 'awaiting_response'
                  const meta = getRiskCaseStatusMeta(status)
                  return (
                    <tr key={item.activityId} className="align-top text-[#333] hover:bg-[#fafafa]">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff1268]" />
                          <div>
                            <div className="font-medium text-[#111]">{item.activityName}</div>
                            <div className="mt-1 text-[12px] text-[#999]">活动编号：{item.activityId} · 主办方编号：{item.organizerId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#666]">{item.latestSubmittedBy ? `提交人编号：${item.latestSubmittedBy}` : '暂无艺人字段'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#666]">{formatDate(item.riskSuspendedAt) || '-'}</td>
                      <td className="max-w-[260px] px-4 py-3 text-[#666]">{item.riskSuspendedReason || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {status === 'pending' ? (
                          <button type="button" onClick={() => openRiskCaseDialog(item)} className="rounded-lg border border-[#ff1268] px-4 py-2 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]">
                            去审核处置
                          </button>
                        ) : status === 'approved' || status === 'rejected' ? (
                          <button type="button" onClick={() => openRiskCaseDialog(item)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268]">
                            查看恢复记录
                          </button>
                        ) : (
                          <span className={getRiskCaseActionClassName(status)}>{formatRiskCaseActionLabel(status)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <GlobalPagination page={page} total={visible.length} loading={loading} onChange={setPage} />
        </div>
      )}
      <Modal
        open={Boolean(riskCaseDialog)}
        onClose={() => {
          if (processingId) return
          setRiskCaseDialog(null)
          setReviewError('')
        }}
        title={riskCaseDialog?.item.latestResolutionStatus === 'pending' ? '风险恢复审核处置' : '风险恢复记录'}
        size="lg"
        loading={Boolean(processingId)}
        footer={riskCaseDialog?.item.latestResolutionStatus === 'pending' ? (
          <>
            <button type="button" onClick={() => { if (!processingId) { setRiskCaseDialog(null); setReviewError('') } }} disabled={Boolean(processingId)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[13px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60">取消</button>
            <button type="button" onClick={() => submitRiskCaseReview('reject')} disabled={Boolean(processingId)} className="rounded-lg bg-[#f53f3f] px-4 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">驳回恢复</button>
            <button type="button" onClick={() => submitRiskCaseReview('approve')} disabled={Boolean(processingId)} className="rounded-lg bg-[#22c55e] px-4 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">通过恢复</button>
          </>
        ) : undefined}
      >
        {riskCaseDialog ? (
          <div className="space-y-4 text-[13px] text-[#666]">
            <div className="text-[14px] font-semibold text-[#111]">上下文对比</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-[#fff7fa] p-3">
                <div className="mb-1 font-medium text-[#333]">风险停票上下文</div>
                <div>演出：{riskCaseDialog.item.activityName}</div>
                <div>停售时间：{formatDate(riskCaseDialog.item.riskSuspendedAt) || '-'}</div>
                <div>触发原因：{riskCaseDialog.item.riskSuspendedReason || '-'}</div>
              </div>
              <div className="rounded-lg bg-[#f9fafb] p-3">
                <div className="mb-1 font-medium text-[#333]">恢复申请上下文</div>
                <div>恢复记录：{riskCaseDialog.item.latestResolutionId || '-'}</div>
                <div>进展状态：{getRiskCaseStatusMeta(riskCaseDialog.item.latestResolutionStatus || 'awaiting_response').label}</div>
                <div>处置说明：{riskCaseDialog.item.latestResolutionNote || '-'}</div>
              </div>
            </div>
            {riskCaseDialog.item.latestResolutionStatus === 'pending' ? (
              <label className="block font-medium text-[#333]">
                审核意见
                <textarea
                  value={riskCaseDialog.note}
                  onChange={event => {
                    setRiskCaseDialog({ ...riskCaseDialog, note: event.target.value })
                    if (event.target.value.trim()) setReviewError('')
                  }}
                  rows={4}
                  placeholder="驳回恢复时必须填写原因"
                  className="mt-1 w-full resize-none rounded-lg border border-[#e5e5e5] px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
                />
              </label>
            ) : null}
            {reviewError ? <div className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-500">{reviewError}</div> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
