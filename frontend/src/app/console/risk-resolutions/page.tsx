'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { listActivityRiskResolutions, reviewActivityRiskResolution } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import type { ActivityRiskResolutionVO } from '@/types/api'

type ResolutionStatus = 'pending' | 'approved' | 'rejected' | ''

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
  const [notes, setNotes] = useState<Record<number, string>>({})
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

  const review = async (item: ActivityRiskResolutionVO, action: 'approve' | 'reject') => {
    if (!isReviewableRiskResolutionStatus(item.status)) {
      setError('恢复售票审核状态待核对，请刷新后再操作')
      return
    }
    setProcessingId(item.id)
    setError('')
    try {
      const note = notes[item.id] || ''
      await reviewActivityRiskResolution(item.id, { userId, action, reviewNote: note.trim() || null })
      setNotes(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
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
                  <>
                    <textarea
                      value={notes[item.id] || ''}
                      onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
                      className="mt-3 h-20 w-full rounded-xl border border-[#ddd] p-3 text-[14px]"
                      placeholder="审核备注"
                    />
                    <div className="mt-3 flex gap-2">
                      <button disabled={processingId === item.id} onClick={() => review(item, 'approve')} className="rounded-full bg-[#16a34a] px-4 py-2 text-[13px] text-white disabled:opacity-60">通过恢复</button>
                      <button disabled={processingId === item.id} onClick={() => review(item, 'reject')} className="rounded-full bg-[#ef4444] px-4 py-2 text-[13px] text-white disabled:opacity-60">拒绝</button>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-[12px] text-[#999]">{isKnownRiskResolutionStatus(item.status) ? '历史记录仅供查看。' : '状态待核对'}</div>
                )}
              </div>
            )
          })}
          <GlobalPagination page={page} total={items.length} loading={loading} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

function normalizeStatus(value: string | null): ResolutionStatus {
  return value === 'approved' || value === 'rejected' || value === 'pending' ? value : 'pending'
}
