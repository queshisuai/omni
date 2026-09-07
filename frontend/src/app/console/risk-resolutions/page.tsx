'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { listActivityRiskResolutions, reviewActivityRiskResolution } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Modal } from '@/components/ui/Modal'
import type { ActivityRiskResolutionVO } from '@/types/api'

type ResolutionStatus = 'pending' | 'approved' | 'rejected' | ''
type ResolutionReviewAction = 'approve' | 'reject'

interface ResolutionReviewDialog {
  item: ActivityRiskResolutionVO
  action: ResolutionReviewAction
  note: string
}

const STATUS_OPTIONS: { value: ResolutionStatus; label: string }[] = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: '', label: '全部记录' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

function formatResolutionStatus(status: string) {
  return STATUS_LABEL[status] || '未知审核状态'
}

function isKnownRiskResolutionStatus(status?: string | null) {
  return status === 'pending' || status === 'approved' || status === 'rejected'
}

function isReviewableRiskResolutionStatus(status?: string | null) {
  return status === 'pending'
}

export default function RiskResolutionsPage() {
  return (
    <Suspense fallback={<div className="text-[#999]">加载中...</div>}>
      <RiskResolutionsContent />
    </Suspense>
  )
}

function RiskResolutionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ActivityRiskResolutionVO[]>([])
  const [userId, setUserId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolutionReviewDialog, setResolutionReviewDialog] = useState<ResolutionReviewDialog | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const status = normalizeStatus(searchParams.get('status'))
  const activityId = searchParams.get('activityId') || ''

  const loadData = async (nextStatus = status) => {
    setLoading(true)
    setError('')
    try {
      const data = await listActivityRiskResolutions(nextStatus || undefined)
      const visible = activityId ? data.filter(item => String(item.activityId) === activityId) : data
      setItems(visible)
      setPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载恢复申请失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login?ru=/console/risk-resolutions')
      return
    }
    setUserId(user.userId)
    void loadData(status)
  }, [router, status, activityId])

  const setStatus = (nextStatus: ResolutionStatus) => {
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (nextStatus) params.set('status', nextStatus)
    else params.delete('status')
    router.replace(`/console/risk-resolutions?${params.toString()}`)
  }

  const pageItems = useMemo(() => items.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [items, page])

  const openResolutionReviewDialog = (item: ActivityRiskResolutionVO) => {
    if (!isReviewableRiskResolutionStatus(item.status)) {
      setError('恢复售票审核状态待核对，请刷新后再操作')
      return
    }
    setError('')
    setReviewError('')
    setResolutionReviewDialog({ item, action: 'approve', note: '' })
  }

  const closeResolutionReviewDialog = () => {
    if (processingId) return
    setResolutionReviewDialog(null)
    setReviewError('')
  }

  const submitResolutionReview = async () => {
    if (!resolutionReviewDialog) return
    const { item, action } = resolutionReviewDialog
    if (!isReviewableRiskResolutionStatus(item.status)) {
      setError('恢复售票审核状态待核对，请刷新后再操作')
      closeResolutionReviewDialog()
      return
    }
    const note = resolutionReviewDialog.note.trim()
    if (action === 'reject' && !note) {
      setReviewError('拒绝原因不能为空')
      return
    }
    setProcessingId(item.id)
    setError('')
    setReviewError('')
    try {
      await reviewActivityRiskResolution(item.id, { userId, action, reviewNote: note || null })
      setResolutionReviewDialog(null)
      await loadData(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核恢复申请失败')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">恢复售票审核 / 记录</h1>
        <p className="mt-1 text-[13px] text-[#999]">审核风险停票活动的恢复申请，并查看历史恢复记录。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(option => (
          <button
            key={option.label}
            onClick={() => setStatus(option.value)}
            className="rounded-full border bg-white px-3 py-1 text-[12px] outline-none"
            style={{
              borderColor: status === option.value ? '#ff1268' : '#ddd',
              color: status === option.value ? '#ff1268' : '#666',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-[#fef2f2] p-3 text-[#dc2626]">{error}</div>}
      {loading ? <div className="text-[#999]">加载中...</div> : items.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-[#999]">暂无恢复申请记录</div> : (
        <div className="space-y-3">
          {pageItems.map(item => {
            const reviewable = isReviewableRiskResolutionStatus(item.status)
            return (
              <div key={item.id} className="rounded-xl border border-[#eee] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-[#1a1a2e]">{item.activityName || `活动编号：${item.activityId}`}</div>
                  <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{formatResolutionStatus(item.status)}</span>
                </div>
                <div className="mt-1 text-[12px] text-[#999]">活动编号：{item.activityId}</div>
                <div className="mt-1 text-[13px] text-[#666]">处理说明：{item.resolutionNote || '未填写'}</div>
                {item.reviewNote && <div className="mt-1 text-[13px] text-[#666]">审核备注：{item.reviewNote}</div>}
                {reviewable ? (
                  <button disabled={processingId === item.id} onClick={() => openResolutionReviewDialog(item)} className="mt-3 rounded-full bg-[#ff1268] px-4 py-2 text-[13px] text-white disabled:opacity-60">审核处理</button>
                ) : (
                  <div className="mt-3 text-[12px] text-[#999]">{isKnownRiskResolutionStatus(item.status) ? '历史记录仅供查看。' : '状态待核对'}</div>
                )}
              </div>
            )
          })}
          <GlobalPagination page={page} total={items.length} loading={loading} onChange={setPage} />
        </div>
      )}
      <Modal
        open={Boolean(resolutionReviewDialog)}
        onClose={closeResolutionReviewDialog}
        title="恢复售票审核处理"
        size="md"
        danger={resolutionReviewDialog?.action === 'reject'}
        loading={Boolean(processingId)}
        footer={(
          <>
            <button type="button" onClick={closeResolutionReviewDialog} disabled={Boolean(processingId)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60">取消</button>
            <button type="button" onClick={submitResolutionReview} disabled={Boolean(processingId)} className={`rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${resolutionReviewDialog?.action === 'reject' ? 'bg-[#f53f3f] hover:bg-[#d92d2d]' : 'bg-[#16a34a] hover:bg-[#13813b]'}`}>
              {processingId ? '提交中...' : resolutionReviewDialog?.action === 'reject' ? '确认拒绝' : '确认通过'}
            </button>
          </>
        )}
      >
        {resolutionReviewDialog ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#fafafa] p-3 text-[13px] text-[#666]">
              {resolutionReviewDialog.item.activityName || `活动编号：${resolutionReviewDialog.item.activityId}`}
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#e5e5e5] p-2 text-[13px]">
              <button type="button" onClick={() => setResolutionReviewDialog({ ...resolutionReviewDialog, action: 'approve' })} className={`rounded-lg px-3 py-2 ${resolutionReviewDialog.action === 'approve' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#666]'}`}>通过恢复</button>
              <button type="button" onClick={() => setResolutionReviewDialog({ ...resolutionReviewDialog, action: 'reject' })} className={`rounded-lg px-3 py-2 ${resolutionReviewDialog.action === 'reject' ? 'bg-[#f53f3f] text-white' : 'bg-white text-[#666]'}`}>拒绝恢复</button>
            </div>
            <label className="block text-[13px] font-medium text-[#333]">
              {resolutionReviewDialog.action === 'reject' ? '拒绝原因 *' : '审核意见'}
              <textarea
                value={resolutionReviewDialog.note}
                onChange={event => {
                  setResolutionReviewDialog({ ...resolutionReviewDialog, note: event.target.value })
                  if (event.target.value.trim()) setReviewError('')
                }}
                rows={4}
                placeholder={resolutionReviewDialog.action === 'reject' ? '请输入拒绝原因（必填）' : '请输入审核意见（可选）'}
                className={`mt-1 w-full resize-none rounded-xl border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
            </label>
            {reviewError && <div className="text-[13px] text-[#dc2626]">{reviewError}</div>}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function normalizeStatus(value: string | null): ResolutionStatus {
  return value === 'approved' || value === 'rejected' || value === 'pending' ? value : 'pending'
}
