'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SafeImage } from '@/components/SafeImage'
import { CONSOLE_TABLE_HEADER_CLASS, ConsoleTable } from '@/components/ConsoleTable'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import { getUser } from '@/lib/auth'
import {
  approveActivityRiskResolution,
  listActivityRiskResolutions,
  rejectActivityRiskResolution,
} from '@/lib/api'
import type { ActivityRiskResolutionVO, RiskResolutionListParams } from '@/types/api'

type ResolutionStatus = 'pending' | 'approved' | 'rejected'

const STATUS_TABS: Array<{ key: ResolutionStatus; label: string }> = [
  { key: 'pending', label: '待审批恢复申请' },
  { key: 'approved', label: '已恢复售票记录' },
  { key: 'rejected', label: '已驳回整改申请' },
]

const REASON_TYPES = [
  '场馆安防/消防资质缺失熔断',
  '艺人风控关联停售',
  '高频库存/超售异常熔断',
  '其他行政指令',
]

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已恢复',
  rejected: '已驳回',
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusClassName(status?: string | null) {
  if (status === 'approved') return 'bg-[#f0fdf4] text-[#15803d]'
  if (status === 'rejected') return 'bg-[#fef2f2] text-[#b91c1c]'
  return 'bg-[#fffbeb] text-[#b45309]'
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(url)
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
  const initialStatus = normalizeStatus(searchParams.get('status'))
  const activityId = searchParams.get('activityId') || ''
  const [activeStatus, setActiveStatus] = useState<ResolutionStatus>(initialStatus)
  const [keywordInput, setKeywordInput] = useState(activityId)
  const [keyword, setKeyword] = useState(activityId)
  const [reasonType, setReasonType] = useState('')
  const [items, setItems] = useState<ActivityRiskResolutionVO[]>([])
  const [selected, setSelected] = useState<ActivityRiskResolutionVO | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [previewImage, setPreviewImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await listActivityRiskResolutions({ page: 1, size: 1, status: 'pending' })
      setPendingCount(res.total || 0)
    } catch {
      setPendingCount(0)
    }
  }, [])

  const loadData = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const params: RiskResolutionListParams = {
        page: nextPage,
        size: DEFAULT_PAGE_SIZE,
        status: activeStatus,
        keyword,
        reasonType,
      }
      const res = await listActivityRiskResolutions(params)
      setItems(res.records || [])
      setTotal(res.total || 0)
      setPage(res.current || nextPage)
      if (activeStatus === 'pending') setPendingCount(res.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载恢复售票审核列表失败')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, keyword, page, reasonType])

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login?ru=/console/risk-resolutions')
      return
    }
    void loadPendingCount()
    void loadData(1)
  }, [loadData, loadPendingCount, router])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('status', activeStatus)
    router.replace(`/console/risk-resolutions?${params.toString()}`)
  }, [activeStatus])

  useEffect(() => {
    void loadData(page)
  }, [activeStatus, keyword, page, reasonType])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const openDrawer = (item: ActivityRiskResolutionVO) => {
    setSelected(item)
    setReviewNote('')
    setReviewError('')
  }

  const closeDrawer = () => {
    if (processingAction) return
    setSelected(null)
    setReviewError('')
  }

  const refreshAfterAction = async () => {
    setSelected(null)
    setReviewNote('')
    await loadPendingCount()
    await loadData(page)
  }

  const approveResolution = async () => {
    if (!selected) return
    setProcessingAction('approve')
    setReviewError('')
    try {
      await approveActivityRiskResolution(selected.id, { reviewNote: reviewNote.trim() || null })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '批准恢复售票失败')
    } finally {
      setProcessingAction(null)
    }
  }

  const rejectResolution = async () => {
    if (!selected) return
    const note = reviewNote.trim()
    if (!note) {
      setReviewError('驳回原因不能为空')
      return
    }
    setProcessingAction('reject')
    setReviewError('')
    try {
      await rejectActivityRiskResolution(selected.id, { reviewNote: note })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '驳回恢复申请失败')
    } finally {
      setProcessingAction(null)
    }
  }

  const attachments = useMemo(() => selected?.attachmentUrls?.filter(Boolean) || [], [selected])
  const reviewable = selected?.status === 'pending'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">恢复售票审核 / 记录</h1>
        <p className="mt-1 text-[13px] text-[#999]">核验停售整改材料，批准后立即恢复前台售票。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveStatus(tab.key); setPage(1) }}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${activeStatus === tab.key ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]' : 'border-[#e5e5e5] bg-white text-[#666]'}`}
          >
            {tab.label}
            {tab.key === 'pending' ? <span className="ml-2 rounded-full bg-[#ff1268] px-2 py-0.5 text-[11px] text-white">{pendingCount}</span> : null}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} className="grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 lg:grid-cols-[1fr_260px_auto]">
        <input
          value={keywordInput}
          onChange={event => setKeywordInput(event.target.value)}
          placeholder="搜索活动名称、活动编号、停售风控事件 ID"
          className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
        />
        <select value={reasonType} onChange={event => { setReasonType(event.target.value); setPage(1) }} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部停售原因分类</option>
          {REASON_TYPES.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[#ff1268] px-5 text-[14px] font-medium text-white hover:bg-[#e0105a]">搜索</button>
      </form>

      {error ? <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div> : null}

      <ConsoleTable
        loading={loading}
        skeletonRows={6}
        skeletonColumns={7}
        footer={<GlobalPagination page={page} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading} onChange={setPage} />}
      >
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className={CONSOLE_TABLE_HEADER_CLASS}>
              <tr>
                <th className="px-4 py-3">演出活动名称及编号</th>
                <th className="px-4 py-3">停售触发原因</th>
                <th className="px-4 py-3">主办方整改方案摘要</th>
                <th className="w-40 whitespace-nowrap px-4 py-3">复批证明附件齐全度</th>
                <th className="w-40 whitespace-nowrap px-4 py-3">提报经办人及时间</th>
                <th className="w-24 whitespace-nowrap px-4 py-3 text-center">状态</th>
                <th className="w-28 whitespace-nowrap py-3 pr-4 pl-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#999]">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#999]">暂无恢复售票审核记录</td></tr>
              ) : items.map(item => (
                <tr key={item.id} onClick={() => openDrawer(item)} className="cursor-pointer align-top text-[#333] hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <SafeImage src={item.activityPoster} alt={item.activityName || '活动海报'} fallbackText="票" className="h-12 w-10 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#1a1a2e]" title={item.activityName || ''}>{item.activityName || '未命名活动'}</div>
                        <div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">活动编号：{item.activityId} · 恢复单：{item.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate text-[#666]" title={item.riskSuspendedReason || ''}>{item.riskSuspendedReason || '停售原因待核实'}</div>
                    <div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">触发时间：{formatDate(item.riskSuspendedAt)}</div>
                  </td>
                  <td className="truncate px-4 py-3 text-[#666]" title={item.resolutionNote || ''}>{item.resolutionNote || '未填写整改方案'}</td>
                  <td className="px-4 py-3 text-[#666]">{item.attachmentUrls?.length ? `已上传 ${item.attachmentUrls.length} 份` : '暂无复批附件'}</td>
                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap text-[#666]">经办人编号：{item.submittedBy || '-'}</div>
                    <div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">{formatDate(item.createTime)}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${statusClassName(item.status)}`}>{STATUS_LABEL[item.status] || '未知状态'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={event => { event.stopPropagation(); openDrawer(item) }} className="whitespace-nowrap rounded-lg border border-[#ff1268] px-3 py-1.5 text-[12px] text-[#ff1268] hover:bg-[#fff0f5]">
                      {item.status === 'pending' ? '恢复处理' : '查看详情'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ConsoleTable>

      <Drawer open={Boolean(selected)} onClose={closeDrawer} title={selected ? `${selected.status === 'pending' ? '恢复处理' : '查看详情'}：${selected.activityName || selected.activityId}` : '恢复售票审核'} width="w-[640px]" loading={Boolean(processingAction)}>
        {selected ? (
          <div className="space-y-5 text-[13px] text-[#555]">
            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">停售事件回溯</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="活动编号" value={String(selected.activityId)} />
                <InfoItem label="恢复申请编号" value={String(selected.id)} />
                <InfoItem label="熔断事件类型" value={selected.riskSuspendedReason || '停售原因待核实'} />
                <InfoItem label="触发时间" value={formatDate(selected.riskSuspendedAt)} />
              </div>
            </section>

            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">整改答复与说明</div>
              <p className="whitespace-pre-wrap rounded-lg bg-[#fafafa] p-3 leading-6">{selected.resolutionNote || '主办方暂未填写整改答复'}</p>
            </section>

            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">整改复批批文凭据</div>
              {attachments.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {attachments.map(url => (
                    isImageUrl(url) ? (
                      <button key={url} type="button" onClick={() => setPreviewImage(url)} className="overflow-hidden rounded-lg border border-[#e5e5e5]">
                        <SafeImage src={url} alt="复批批文凭据" className="h-36 w-full object-cover" />
                      </button>
                    ) : (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-[#ff1268] px-4 py-3 text-[#ff1268] hover:bg-[#fff0f5]">打开复批附件</a>
                    )
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-[#fffbeb] p-3 text-[#b45309]">暂无复批附件，请结合整改说明和线下批文核验。</div>
              )}
            </section>

            <section className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
              <div className="mb-2 text-[15px] font-semibold text-[#b91c1c]">业务影响告警</div>
              <p className="leading-6 text-[#b91c1c]">审核通过后，系统将立即解除售票熔断，重新开启前台 C 端售票通道，并同步刷新 Elasticsearch 索引！</p>
            </section>

            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">操作控制台</div>
              <textarea
                value={reviewNote}
                onChange={event => {
                  setReviewNote(event.target.value)
                  if (event.target.value.trim()) setReviewError('')
                }}
                rows={4}
                placeholder="请输入审核核销意见；驳回恢复申请时必填"
                className={`w-full resize-none rounded-lg border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
              {reviewError ? <div className="mt-2 rounded-lg bg-[#fef2f2] px-3 py-2 text-[#dc2626]">{reviewError}</div> : null}
              {reviewable ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={Boolean(processingAction)} onClick={rejectResolution} className="rounded-lg bg-[#dc2626] px-4 py-2 text-white disabled:opacity-60">{processingAction === 'reject' ? '提交中...' : '驳回恢复申请'}</button>
                  <button type="button" disabled={Boolean(processingAction)} onClick={approveResolution} className="rounded-lg bg-[#16a34a] px-4 py-2 text-white disabled:opacity-60">{processingAction === 'approve' ? '提交中...' : '批准恢复售票'}</button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </Drawer>

      {previewImage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6" onClick={() => setPreviewImage('')}>
          <SafeImage src={previewImage} alt="复批批文大图" className="max-h-full max-w-full rounded-xl bg-white object-contain" />
        </div>
      ) : null}
    </div>
  )
}

function normalizeStatus(value: string | null): ResolutionStatus {
  return value === 'approved' || value === 'rejected' || value === 'pending' ? value : 'pending'
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#999]">{label}</div>
      <div className="mt-1 truncate font-medium text-[#333]" title={value}>{value}</div>
    </div>
  )
}
