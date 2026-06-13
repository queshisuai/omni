'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminActivities, listActivityRiskResolutions, submitActivityRiskResolution } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/Pagination'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { globalAlert } from '@/components/GlobalDialog'
import type { ActivityEntity, ActivityRiskResolutionVO } from '@/types/api'

const RESOLUTION_TYPES = [
  { value: 'remove_artist', label: '移除阵容' },
  { value: 'reschedule', label: '改期' },
  { value: 'refund', label: '全额退款' },
  { value: 'explain', label: '补充说明' },
] as const

type ResolutionType = typeof RESOLUTION_TYPES[number]['value']

const TYPE_PREFIX: Record<ResolutionType, string> = {
  remove_artist: '[移除阵容]',
  reschedule: '[改期]',
  refund: '[全额退款]',
  explain: '[补充说明]',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_response: { label: '待处理', color: '#6b7280', bg: '#f3f4f6' },
  pending: { label: '审核中', color: '#b45309', bg: '#fffbeb' },
  approved: { label: '已通过', color: '#15803d', bg: '#f0fdf4' },
  rejected: { label: '已驳回', color: '#b91c1c', bg: '#fef2f2' },
}

function getResolutionStatusMeta(status?: string | null) {
  if (!status) return null
  return STATUS_META[status] || { label: '未知审核状态', color: '#6b7280', bg: '#f3f4f6' }
}

function isKnownResolutionStatus(status?: string | null) {
  return !status || Object.prototype.hasOwnProperty.call(STATUS_META, status)
}

function canSubmitRiskResolution(status?: string | null) {
  return isKnownResolutionStatus(status) && status !== 'pending'
}

function formatRiskResolutionSubmitLabel(status?: string | null) {
  if (status === 'pending') return '审核中'
  if (!canSubmitRiskResolution(status)) return '状态待核对'
  return '提交恢复申请'
}

function formatRiskResolutionSubmitBlockedMessage(status?: string | null) {
  if (!isKnownResolutionStatus(status)) return '恢复售票审核状态待核对，请刷新后再操作'
  if (status === 'pending') return '当前恢复售票申请正在审核中，请刷新后再操作'
  return ''
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function OrganizerRiskEventsPage() {
  const [userId, setUserId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suspended, setSuspended] = useState<ActivityEntity[]>([])
  const [resolutions, setResolutions] = useState<ActivityRiskResolutionVO[]>([])
  const [target, setTarget] = useState<ActivityEntity | null>(null)
  const [resolutionType, setResolutionType] = useState<ResolutionType>('explain')
  const [resolutionNote, setResolutionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)

  const loadData = async (uid: number) => {
    setLoading(true)
    setError('')
    try {
      const [activitiesPage, resolutionList] = await Promise.all([
        listAdminActivities({ page: 1, size: 100 }),
        listActivityRiskResolutions(),
      ])
      const items = (activitiesPage.records || []).filter((a) => a.publishStatus === 'risk_suspended')
      setSuspended(items)
      setResolutions(resolutionList || [])
      setPage(1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载风险事件失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (!user) return
    setUserId(user.userId)
    loadData(user.userId)
  }, [])

  const latestResolutionByActivity = useMemo(() => {
    const map = new Map<number, ActivityRiskResolutionVO>()
    for (const r of resolutions) {
      const exist = map.get(r.activityId)
      if (!exist) { map.set(r.activityId, r); continue }
      const a = new Date(exist.reviewedAt || '').getTime() || exist.id
      const b = new Date(r.reviewedAt || '').getTime() || r.id
      if (b > a) map.set(r.activityId, r)
    }
    return map
  }, [resolutions])
  const pageSuspended = useMemo(() => suspended.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [suspended, page])

  const closeDialog = () => {
    if (submitting) return
    setTarget(null); setResolutionNote(''); setResolutionType('explain')
  }

  const submit = async () => {
    if (!target) return
    const blockedMessage = formatRiskResolutionSubmitBlockedMessage(latestResolutionByActivity.get(target.id)?.status)
    if (blockedMessage) { await globalAlert(blockedMessage); return }
    if (!resolutionNote.trim()) { await globalAlert('处理说明不能为空'); return }
    setSubmitting(true)
    try {
      await submitActivityRiskResolution(target.id, {
        userId,
        resolutionNote: `${TYPE_PREFIX[resolutionType]} ${resolutionNote.trim()}`,
      })
      await globalAlert('已提交恢复售票申请，等待平台审核。')
      setTarget(null); setResolutionNote(''); setResolutionType('explain')
      await loadData(userId)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">风险事件待办</h1>
          <p className="mt-1 text-[13px] text-[#999]">展示因艺人风险被平台暂停售票的活动，并支持提交恢复申请。</p>
        </div>
        <button
          onClick={() => loadData(userId)}
          className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]"
        >
          <RefreshCw className="h-4 w-4" /> 刷新
        </button>
      </div>
      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
      ) : suspended.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无风险事件，所有活动状态正常。</div>
      ) : (
        <>
          <RiskList
            suspended={pageSuspended}
            latestResolutionByActivity={latestResolutionByActivity}
            onBlocked={(message) => { void globalAlert(message) }}
            onOpenDialog={(a) => { setTarget(a); setResolutionType('explain'); setResolutionNote('') }}
          />
          <Pagination page={page} total={suspended.length} loading={loading} onChange={setPage} />
        </>
      )}
      {target && (
        <ResolutionDialog
          target={target}
          resolutionType={resolutionType}
          resolutionNote={resolutionNote}
          submitting={submitting}
          onTypeChange={setResolutionType}
          onNoteChange={setResolutionNote}
          onClose={closeDialog}
          onSubmit={submit}
        />
      )}
    </div>
  )
}

function RiskList({ suspended, latestResolutionByActivity, onBlocked, onOpenDialog }: {
  suspended: ActivityEntity[]
  latestResolutionByActivity: Map<number, ActivityRiskResolutionVO>
  onBlocked: (message: string) => void
  onOpenDialog: (a: ActivityEntity) => void
}) {
  return (
    <div className="space-y-3">
      {suspended.map((activity) => {
        const latest = latestResolutionByActivity.get(activity.id)
        const meta = getResolutionStatusMeta(latest?.status)
        const canSubmitResolution = canSubmitRiskResolution(latest?.status)
        return (
          <div key={activity.id} className="rounded-xl border border-[#ffd9e6] bg-white p-5">
            <div className="flex flex-wrap items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff1268]" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-medium text-[#111]">{activity.name}</span>
                  <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[12px] text-[#b91c1c]">风险停票</span>
                  {meta && <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ color: meta.color, backgroundColor: meta.bg }}>恢复申请：{meta.label}</span>}
                </div>
                {activity.riskSuspendedReason && (
                  <div className="mt-2 text-[13px] leading-5 text-[#666]">停售原因：{activity.riskSuspendedReason}</div>
                )}
                {activity.riskSuspendedAt && (
                  <div className="mt-1 text-[12px] text-[#999]">停售时间：{formatDate(activity.riskSuspendedAt)}</div>
                )}
                {latest?.resolutionNote && (
                  <div className="mt-2 rounded bg-[#f9fafb] px-3 py-2 text-[12px] leading-5 text-[#444]">最近一次处置：{latest.resolutionNote}</div>
                )}
                {latest?.reviewNote && (
                  <div className="mt-1 text-[12px] leading-5 text-[#666]">平台审核意见：{latest.reviewNote}</div>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <button
                  onClick={() => {
                    const blockedMessage = formatRiskResolutionSubmitBlockedMessage(latest?.status)
                    if (blockedMessage) { onBlocked(blockedMessage); return }
                    onOpenDialog(activity)
                  }}
                  disabled={!canSubmitResolution}
                  className="rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] text-white disabled:bg-[#f7c6d6]"
                >
                  {formatRiskResolutionSubmitLabel(latest?.status)}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResolutionDialog({ target, resolutionType, resolutionNote, submitting, onTypeChange, onNoteChange, onClose, onSubmit }: {
  target: ActivityEntity
  resolutionType: ResolutionType
  resolutionNote: string
  submitting: boolean
  onTypeChange: (t: ResolutionType) => void
  onNoteChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-[520px] rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-[18px] font-medium text-[#111]">提交恢复售票申请</h2>
        <p className="mb-4 text-[13px] leading-5 text-[#666]">活动：{target.name}</p>
        <div className="mb-3">
          <div className="mb-2 text-[13px] text-[#333]">处置方式</div>
          <div className="grid grid-cols-2 gap-2">
            {RESOLUTION_TYPES.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onTypeChange(option.value)}
                disabled={submitting}
                className="cursor-pointer rounded border bg-white px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: resolutionType === option.value ? '#ff1268' : '#ddd', color: resolutionType === option.value ? '#ff1268' : '#666' }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={resolutionNote}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="请描述具体处置动作，例如：已下线风险艺人 张三，并向 218 名购票用户发出阵容变更通知。"
          className="mb-4 h-[120px] w-full resize-none rounded border border-[#ddd] px-3 py-2 text-[14px] text-[#333] outline-none focus:border-[#ff1268]"
          maxLength={500}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="cursor-pointer rounded border border-[#ddd] bg-white px-5 py-2 text-[14px] text-[#666] outline-none" style={{ opacity: submitting ? 0.7 : 1 }}>取消</button>
          <button onClick={onSubmit} disabled={submitting} className="cursor-pointer rounded border-none bg-[#ff1268] px-5 py-2 text-[14px] text-white outline-none" style={{ opacity: submitting ? 0.7 : 1 }}>{submitting ? '提交中...' : '提交申请'}</button>
        </div>
      </div>
    </div>
  )
}
