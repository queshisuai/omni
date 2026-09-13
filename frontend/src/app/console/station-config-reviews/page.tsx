'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getUser, updateStoredUser } from '@/lib/auth'
import {
  approveStationConfigReview,
  getStationConfigReviewDiff,
  getUserInfo,
  listStationConfigReviews,
  rejectStationConfigReview,
} from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import { formatStationConfigChangeType, formatStationConfigStatus, isReviewableStationConfigStatus } from '@/lib/operation-display'
import { CONSOLE_TABLE_HEADER_CLASS, ConsoleTable } from '@/components/ConsoleTable'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import type { StationConfigReviewDiffVO, StationConfigVersionVO } from '@/types/api'

type ReviewTabKey = 'submitted' | 'applied' | 'rejected'

const STATUS_TABS: Array<{ key: ReviewTabKey; label: string }> = [
  { key: 'submitted', label: '待审批变更单' },
  { key: 'applied', label: '历史变更生效归档' },
  { key: 'rejected', label: '已否决变更单' },
]

const CHANGE_TYPE_OPTIONS = [
  { value: 'change_schedule', label: '开演时间调整' },
  { value: 'change_venue', label: '更换物理场馆' },
  { value: 'seat_layout_reset', label: '座位图版本重置' },
  { value: 'set_schedule', label: '票档配置微调' },
]

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isHighRiskChange(changeType?: string | null) {
  return changeType === 'change_venue' || changeType === 'seat_layout_reset' || changeType === 'reset_seat_map' || changeType === 'seat_map_reset'
}

function statusClassName(status?: string | null) {
  if (status === 'applied') return 'bg-[#f0fdf4] text-[#15803d]'
  if (status === 'rejected') return 'bg-[#fef2f2] text-[#b91c1c]'
  return 'bg-[#fffbeb] text-[#b45309]'
}

export default function StationConfigReviewsPage() {
  const [items, setItems] = useState<StationConfigVersionVO[]>([])
  const [activeStatus, setActiveStatus] = useState<ReviewTabKey>('submitted')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [changeType, setChangeType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [selected, setSelected] = useState<StationConfigVersionVO | null>(null)
  const [diff, setDiff] = useState<StationConfigReviewDiffVO | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await listStationConfigReviews({ page: 1, size: 1, status: 'submitted' })
      setPendingCount(res.total || 0)
    } catch {
      setPendingCount(0)
    }
  }, [])

  const loadReviews = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const res = await listStationConfigReviews({
        page: nextPage,
        size: DEFAULT_PAGE_SIZE,
        keyword,
        city,
        changeType,
        status: activeStatus,
      })
      setItems(res.records || [])
      setTotal(res.total || 0)
      setPage(res.current || nextPage)
      if (activeStatus === 'submitted') setPendingCount(res.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载站点变更审核列表失败')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, changeType, city, keyword, page])

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setForbidden(true)
      setLoading(false)
      return
    }
    let active = true
    getUserInfo()
      .then(info => {
        if (!active) return
        const permissions = info.permissionCodes || []
        updateStoredUser({ role: info.role, nickname: info.nickname, permissionCodes: permissions })
        if (!canUseConsoleAction('station.review', permissions)) {
          setForbidden(true)
          setLoading(false)
          return
        }
        void loadPendingCount()
        void loadReviews(1)
      })
      .catch(err => {
        if (!active) return
        setError(err instanceof Error ? err.message : '校验后台权限失败')
        setLoading(false)
      })
    return () => { active = false }
  }, [loadPendingCount, loadReviews])

  useEffect(() => {
    if (forbidden) return
    void loadReviews(page)
  }, [activeStatus, changeType, city, keyword, page])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const openDrawer = async (item: StationConfigVersionVO) => {
    setSelected(item)
    setReviewNote('')
    setReviewError('')
    setDiff(null)
    setDiffLoading(true)
    try {
      setDiff(await getStationConfigReviewDiff(item.id))
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '加载 Diff 变更失败')
    } finally {
      setDiffLoading(false)
    }
  }

  const closeDrawer = () => {
    if (processingAction) return
    setSelected(null)
    setDiff(null)
    setReviewError('')
  }

  const refreshAfterAction = async () => {
    setSelected(null)
    setDiff(null)
    setReviewNote('')
    await loadPendingCount()
    await loadReviews(page)
  }

  const approveReview = async () => {
    if (!selected) return
    setProcessingAction('approve')
    setReviewError('')
    try {
      await approveStationConfigReview(selected.id, { reviewNote: reviewNote.trim() || null })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '批准变更失败')
    } finally {
      setProcessingAction(null)
    }
  }

  const rejectReview = async () => {
    if (!selected) return
    const note = reviewNote.trim()
    if (!note) {
      setReviewError('驳回原因不能为空')
      return
    }
    setProcessingAction('reject')
    setReviewError('')
    try {
      await rejectStationConfigReview(selected.id, { reviewNote: note })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '驳回变更失败')
    } finally {
      setProcessingAction(null)
    }
  }

  const reviewable = selected ? isReviewableStationConfigStatus(selected.status) : false
  const highRisk = Boolean(diff?.highRisk || isHighRiskChange(selected?.changeType))

  if (loading && items.length === 0 && !error) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (forbidden) {
    return <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">无权限访问</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">站点变更审核</h1>
        <p className="mt-1 text-[13px] text-[#999]">审查巡演站点版本变更，重点核对场馆、时间和 SeatCraft 座位图影响。</p>
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
            {tab.key === 'submitted' ? <span className="ml-2 rounded-full bg-[#ff1268] px-2 py-0.5 text-[11px] text-white">{pendingCount}</span> : null}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} className="grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 lg:grid-cols-[1fr_160px_210px_auto]">
        <input
          value={keywordInput}
          onChange={event => setKeywordInput(event.target.value)}
          placeholder="搜索巡演项目名称、站点名称或编号"
          className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
        />
        <input value={city} onChange={event => { setCity(event.target.value); setPage(1) }} placeholder="城市筛选" className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        <select value={changeType} onChange={event => { setChangeType(event.target.value); setPage(1) }} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部变更核心类型</option>
          {CHANGE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[#ff1268] px-5 text-[14px] font-medium text-white hover:bg-[#e0105a]">搜索</button>
      </form>

      {error ? <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div> : null}

      <ConsoleTable
        loading={loading}
        skeletonRows={6}
        skeletonColumns={8}
        footer={<GlobalPagination page={page} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading} onChange={setPage} />}
      >
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className={CONSOLE_TABLE_HEADER_CLASS}>
              <tr>
                <th className="w-[18%] px-4 py-3">巡演项目 / 站点名称及站点 ID</th>
                <th className="w-[8%] px-4 py-3">所属城市</th>
                <th className="w-[9%] px-4 py-3">申请变更版本号</th>
                <th className="w-[13%] px-4 py-3">变更核心类型</th>
                <th className="w-[19%] px-4 py-3">提报申请事由</th>
                <th className="w-[13%] px-4 py-3">提报经办人与申请时间</th>
                <th className="w-[8%] px-4 py-3">状态</th>
                <th className="w-[12%] whitespace-nowrap px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#999]">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#999]">暂无站点变更审核记录</td></tr>
              ) : items.map(item => (
                <tr key={item.id} onClick={() => { void openDrawer(item) }} className="cursor-pointer align-top text-[#333] hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="truncate font-semibold text-[#1a1a2e]" title={item.stationName || ''}>{item.stationName || (item.city ? `${item.city}站` : '未命名站点')}</div>
                    <div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">站点 ID：{item.stationId} · 巡演：{item.tourId || '-'} · 活动：{item.activityId || '-'}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#666]">{item.city || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#666]">{item.versionNo ? `v${item.versionNo}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap">{formatStationConfigChangeType(item.changeType)}</span>
                    {isHighRiskChange(item.changeType) ? <span className="ml-2 rounded-full bg-[#fef2f2] px-2 py-0.5 text-[11px] text-[#dc2626]">高危</span> : null}
                  </td>
                  <td className="truncate px-4 py-3 text-[#666]" title={item.reason || ''}>{item.reason || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap text-[#666]">经办人编号：{item.createdBy || '-'}</div>
                    <div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">{formatDate(item.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${statusClassName(item.status)}`}>{formatStationConfigStatus(item.status)}</span></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={event => { event.stopPropagation(); void openDrawer(item) }} className="whitespace-nowrap rounded-lg border border-[#ff1268] px-3 py-1.5 text-[12px] text-[#ff1268] hover:bg-[#fff0f5]">
                      {isReviewableStationConfigStatus(item.status) ? '审查 Diff 变更' : '查看历史版本'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ConsoleTable>

      <Drawer open={Boolean(selected)} onClose={closeDrawer} title={selected ? `${isReviewableStationConfigStatus(selected.status) ? '审查 Diff 变更' : '查看历史版本'}：v${selected.versionNo || '-'}` : '站点变更审核'} width="w-[640px]" loading={Boolean(processingAction || diffLoading)}>
        {selected ? (
          <div className="space-y-5 text-[13px] text-[#555]">
            {diffLoading ? <div className="rounded-xl bg-[#fafafa] p-6 text-center text-[#999]">加载 Diff 变更中...</div> : null}
            <section className="grid gap-3 md:grid-cols-2">
              <DiffCard title="变更前 (Current)" tone="red" snapshot={diff?.current} />
              <DiffCard title="变更后 (Target)" tone="green" snapshot={diff?.target} />
            </section>

            {highRisk ? (
              <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-[#92400e]">
                <div className="mb-2 font-semibold">高危风险</div>
                <p className="leading-6">{diff?.warning || '高危风险：该站点已更换物理场馆，原座位图配置将作废！通过后需由主办方重新在 SeatCraft 中配置新座位图方可继续售票，若已有售出订单需评估履约/退换票影响。'}</p>
              </section>
            ) : null}

            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">操作决策区</div>
              <div className="mb-3 rounded-lg bg-[#fafafa] p-3 leading-6 text-[#666]">
                <div>变更核心类型：{formatStationConfigChangeType(selected.changeType)}</div>
                <div>申请事由：{selected.reason || '-'}</div>
              </div>
              <textarea
                value={reviewNote}
                onChange={event => {
                  setReviewNote(event.target.value)
                  if (event.target.value.trim()) setReviewError('')
                }}
                rows={4}
                placeholder="请输入审核意见；驳回变更时必填"
                className={`w-full resize-none rounded-lg border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
              {reviewError ? <div className="mt-2 rounded-lg bg-[#fef2f2] px-3 py-2 text-[#dc2626]">{reviewError}</div> : null}
              {reviewable ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={Boolean(processingAction || diffLoading)} onClick={rejectReview} className="rounded-lg bg-[#dc2626] px-4 py-2 text-white disabled:opacity-60">{processingAction === 'reject' ? '提交中...' : '驳回变更'}</button>
                  <button type="button" disabled={Boolean(processingAction || diffLoading)} onClick={approveReview} className="rounded-lg bg-[#16a34a] px-4 py-2 text-white disabled:opacity-60">{processingAction === 'approve' ? '提交中...' : '批准变更并发布'}</button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
function DiffCard({ title, tone, snapshot }: { title: string; tone: 'red' | 'green'; snapshot?: StationConfigReviewDiffVO['current'] }) {
  const className = tone === 'red' ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-[#bbf7d0] bg-[#f0fdf4]'
  const titleClassName = tone === 'red' ? 'text-[#b91c1c]' : 'text-[#15803d]'
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className={`mb-3 text-[15px] font-semibold ${titleClassName}`}>{title}</div>
      <div className="space-y-2">
        <DiffItem label="开演时间" value={formatDate(snapshot?.startTime)} />
        <DiffItem label="物理场馆" value={snapshot?.venueName || '-'} />
        <DiffItem label="场馆地址" value={snapshot?.venueAddress || '-'} />
        <DiffItem label="站点城市" value={snapshot?.city || '-'} />
        <DiffItem label="SeatCraft 座位图版本" value={snapshot?.seatTemplateSourceId ? `${snapshot.seatTemplateSourceType || 'SeatCraft'} #${snapshot.seatTemplateSourceId}` : '-'} />
        <DiffItem label="总票量" value={snapshot?.totalStock == null ? '-' : String(snapshot.totalStock)} />
      </div>
    </div>
  )
}
function DiffItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#999]">{label}</div>
      <div className="mt-0.5 truncate font-medium text-[#333]" title={value}>{value}</div>
    </div>
  )
}
