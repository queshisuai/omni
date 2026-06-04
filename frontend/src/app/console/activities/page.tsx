'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getToken, getUser } from '@/lib/auth'
import { announceTourCities, deleteTourDraft, deactivateTour, getActivityStation, listAdminActivities, listAdminTours, deleteAdminActivity, updateActivityStatus, deactivateActivity, publishStation, submitActivityRiskResolution, suspendActivityForRisk, privateAssetDownloadUrl } from '@/lib/api'
import { getRealNameRequirementLabel, getTicketTransferAllowedLabel } from '@/lib/activity-flags'
import { canUseConsoleAction, hasConsolePermission, isPlatformAdminRole } from '@/lib/console-auth'
import { Trash2, Eye, EyeOff, RefreshCw, Search, FileDown } from 'lucide-react'
import { globalAlert, globalConfirm, globalPrompt } from '@/components/GlobalDialog'
import type { ActivityEntity, PageResult, RefundImpactResponse, TourEntity, UserRole } from '@/types/api'

const PAGE_SIZE = 10
const ADMIN_FETCH_SIZE = 500

function compareActivityRows(a: ActivityEntity, b: ActivityEntity) {
  const byId = a.id - b.id
  if (byId !== 0) return byId
  return (a.itemType || 'activity').localeCompare(b.itemType || 'activity')
}

function parsePrivateAssetRef(value?: string | null) {
  if (!value?.startsWith('private-asset:')) return null
  const id = Number(value.slice('private-asset:'.length))
  return Number.isInteger(id) && id > 0 ? id : null
}

function activityRowKey(activity: ActivityEntity) {
  return `${activity.itemType || 'activity'}-${activity.id}`
}

function getTourRowStatus(tour: { reviewStatus?: string | null; status: number }) {
  return tour.reviewStatus === 'deactivated' || tour.reviewStatus === 'risk_suspended' ? 0 : tour.status
}

function getActivityStatusText(activity: ActivityEntity) {
  if (activity.publishStatus === 'draft') return '草稿'
  if (activity.publishStatus === 'risk_suspended') return '风险停票'
  if (activity.publishStatus === 'deactivated') return '下架'
  if (activity.publishStatus === 'announced') return '上架'
  return activity.status === 1 ? '上架' : '下架'
}

function getActivityStatusClass(activity: ActivityEntity) {
  if (activity.publishStatus === 'draft') return 'bg-[#fff7ed] text-[#f97316]'
  if (activity.publishStatus === 'risk_suspended') return 'bg-[#fff1f2] text-[#e11d48]'
  return activity.status === 1 ? 'bg-[#f0fff4] text-[#22c55e]' : 'bg-[#f5f5f5] text-[#999]'
}

function canToggleSaleStatus(activity: ActivityEntity) {
  if (activity.publishStatus === 'draft' || activity.publishStatus === 'risk_suspended') return false
  if (activity.itemType === 'tour') {
    return activity.status === 1 && activity.publishStatus !== 'deactivated'
  }
  return true
}

function emptyPage<T>(): PageResult<T> {
  return {
    records: [],
    total: 0,
    size: ADMIN_FETCH_SIZE,
    current: 1,
    pages: 1,
  }
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityEntity[]>([])
  const [userId, setUserId] = useState(0)
  const [role, setRole] = useState<UserRole | ''>('')
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [publishingKey, setPublishingKey] = useState<string | null>(null)
  const loadDataRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const isAdmin = isPlatformAdminRole(role)
  const canManageActivities = hasConsolePermission(role, permissionCodes, 'activity.manage')
  const canManageTours = hasConsolePermission(role, permissionCodes, 'tour.manage')
  const canReviewRisk = canUseConsoleAction('risk.review', permissionCodes)
  const canPublishDraft = (activity: ActivityEntity) => {
    const canManageRowType = activity.itemType === 'tour' ? canManageTours : canManageActivities
    return activity.publishStatus === 'draft' && (canManageRowType || activity.organizerId === userId)
  }

  const loadData = (nextPage = page) => {
    const u = getUser()
    if (!u) {
      setCheckingRole(false)
      setLoading(false)
      return
    }
    setUserId(u.userId)
    setRole(u.role || 'user')
    const permissions = u.permissionCodes || []
    setPermissionCodes(permissions)
    setCheckingRole(false)
    const canLoadActivities = hasConsolePermission(u.role, permissions, 'activity.manage')
    const canLoadTours = hasConsolePermission(u.role, permissions, 'tour.manage')
    if (!canLoadActivities && !canLoadTours) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    Promise.all([
      canLoadActivities ? listAdminActivities({
        page: 1,
        size: ADMIN_FETCH_SIZE,
        keyword,
        status: status === '' ? undefined : Number(status),
      }) : Promise.resolve(emptyPage<ActivityEntity>()),
      canLoadTours ? listAdminTours(u.userId, { page: 1, size: ADMIN_FETCH_SIZE }) : Promise.resolve(emptyPage<TourEntity>()),
    ]).then(([activityRes, tourRes]) => {
      const tourActivities: ActivityEntity[] = tourRes.records
        .filter(tour => !keyword.trim() || tour.title.includes(keyword.trim()))
        .filter(tour => status === '' || getTourRowStatus(tour) === Number(status))
        .map(tour => ({
          id: tour.id,
          itemType: 'tour' as const,
          categoryId: tour.categoryId ?? 0,
          artistId: tour.artistId ?? 0,
          organizerId: tour.organizerId,
          name: tour.title,
          description: tour.description ?? null,
          poster: tour.poster ?? null,
          publishStatus: tour.reviewStatus,
          status: getTourRowStatus(tour),
          createTime: tour.createTime || '',
        }))
      const records = [...activityRes.records.map(activity => ({ ...activity, itemType: 'activity' as const })), ...tourActivities]
        .sort(compareActivityRows)
      const nextTotal = records.length
      const nextPages = Math.ceil(nextTotal / PAGE_SIZE) || 1
      const safePage = Math.min(Math.max(1, nextPage), nextPages)
      setActivities(records.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE))
      setTotal(nextTotal)
      setPages(nextPages)
      setPage(safePage)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载活动失败')
      setLoading(false)
    })
  }

  useEffect(() => {
    loadDataRef.current = loadData
  })

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadDataRef.current()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadDataRef.current(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshWhenVisible()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const alertRefundImpact = async (targetLabel: string, result: RefundImpactResponse) => {
    const abnormalCount = result.refundFailedCount + result.refundUnknownCount + result.refundCompensationRequiredCount
    const summary = `已下架活动 ${result.deactivatedActivityCount} 个，已支付订单 ${result.paidOrderCount} 笔，退款成功 ${result.refundSuccessCount} 笔，退款失败 ${result.refundFailedCount} 笔，结果未知 ${result.refundUnknownCount} 笔，需人工处理 ${result.refundCompensationRequiredCount} 笔。`
    if (abnormalCount > 0) {
      await globalAlert(`${targetLabel}已下架并发起退款，但部分退款失败/结果未知/需人工处理。${summary}`)
    } else {
      await globalAlert(`${targetLabel}已下架并发起退款。${summary}`)
    }
  }

  const handleToggleStatus = async (activity: ActivityEntity) => {
    if (activity.itemType === 'tour') {
      if (activity.status !== 1 || activity.publishStatus === 'deactivated') {
        await globalAlert('该巡演/多站点活动已下架，暂不支持从列表直接重新上架。')
        return
      }
      const confirmed = await globalConfirm('下架并退款后，巡演/多站点活动下已发布的城市站点、场次、票档将全部下架，并直接为所有已支付订单发起真实支付宝退款。“同意退款”表示你确认平台将对这些已支付订单执行退款，可能产生退款失败、结果未知或需人工处理的记录。请确认：同意下架并同意退款。')
      if (!confirmed) return
      const result = await deactivateTour(activity.id, {
        userId,
        confirmRefund: true,
        reason: isAdmin ? '平台下架巡演/多站点活动自动退款' : '主办方下架巡演/多站点活动自动退款',
      })
      await alertRefundImpact('巡演/多站点活动', result)
      loadData(page)
      return
    }
    const newStatus = activity.status === 1 ? 0 : 1
    if (newStatus === 0) {
      const confirmed = await globalConfirm('下架并退款后，活动、场次、票档将全部下架，并直接为所有已支付订单发起真实支付宝退款。“同意退款”表示你确认平台将对这些已支付订单执行退款，可能产生退款失败、结果未知或需人工处理的记录。请确认：同意下架并同意退款。')
      if (!confirmed) return
      const result = await deactivateActivity(activity.id, {
        userId,
        confirmRefund: true,
        reason: isAdmin ? '平台下架活动自动退款' : '主办方下架活动自动退款',
      })
      await alertRefundImpact('活动', result)
    } else {
      await updateActivityStatus(activity.id, { userId, status: newStatus })
    }
    loadData(page)
  }

  const handleDelete = async (activity: ActivityEntity) => {
    if (activity.itemType === 'tour') {
      if (activity.publishStatus !== 'draft') {
        await globalAlert('已发布的巡演活动请先进入巡演详情，按城市站点完成下架/退款处理后再删除。')
        return
      }
      if (!(await globalConfirm('确认删除该巡演活动草稿？'))) return
      await deleteTourDraft(userId, activity.id)
      await globalAlert('巡演活动草稿已删除')
      loadData(page)
      return
    }
    if (activity.publishStatus === 'draft') {
      if (!(await globalConfirm('确认删除该活动草稿？'))) return
      const result = await deleteAdminActivity(activity.id, { userId, reason: '删除活动草稿' })
      await globalAlert(result.message || '活动草稿已删除')
      loadData(page)
      return
    }
    const reason = await globalPrompt('删除活动前请填写原因。已发布且有订单的活动需先完成下架退款。', '删除活动', '请输入删除原因（必填）')
    if (reason === null) return
    if (!reason.trim()) {
      await globalAlert('删除原因不能为空')
      return
    }
    const result = await deleteAdminActivity(activity.id, { userId, reason: reason.trim() })
    await globalAlert(result.message || '活动已删除')
    loadData(page)
  }

  const handlePublishDraft = async (activity: ActivityEntity) => {
    const key = activityRowKey(activity)
    if (activity.itemType === 'tour') {
      const confirmed = await globalConfirm('确认发布该巡演活动草稿并公开城市站点？场馆、时间、座位票档可继续按城市站点补齐。')
      if (!confirmed) return
      setPublishingKey(key)
      try {
        await announceTourCities(userId, activity.id)
        await globalAlert('巡演活动和城市站点已发布，后续请在巡演详情补齐各城市站点的场馆、时间和座位票档。')
        loadData(page)
      } catch (err) {
        await globalAlert(err instanceof Error ? err.message : '发布巡演活动失败')
      } finally {
        setPublishingKey(null)
      }
      return
    }
    const confirmed = await globalConfirm('确认发布该活动草稿？发布前请确认站点场馆审批已通过，座位票档已配置。')
    if (!confirmed) return
    setPublishingKey(key)
    try {
      const detail = await getActivityStation(activity.id)
      await publishStation(detail.station.id, {
        userId,
        scheduleTba: true,
        perUserLimit: activity.perUserLimit ?? null,
      })
      await globalAlert('活动草稿已发布。若需要具体开演时间，请在活动配置中补齐站点排期并检查 SeatCraft 座位票档。')
      loadData(page)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '发布活动失败')
    } finally {
      setPublishingKey(null)
    }
  }

  const [riskTarget, setRiskTarget] = useState<ActivityEntity | null>(null)
  const [riskNote, setRiskNote] = useState('')
  const [riskType, setRiskType] = useState<'remove_artist' | 'reschedule' | 'refund' | 'explain'>('explain')
  const [riskSubmitting, setRiskSubmitting] = useState(false)

  const handleRiskResolution = (activity: ActivityEntity) => {
    setRiskTarget(activity)
    setRiskNote('')
    setRiskType('explain')
  }

  const closeRiskDialog = () => {
    if (riskSubmitting) return
    setRiskTarget(null)
    setRiskNote('')
    setRiskType('explain')
  }

  const submitRiskResolution = async () => {
    if (!riskTarget) return
    if (!riskNote.trim()) {
      await globalAlert('处理说明不能为空')
      return
    }
    const TYPE_PREFIX: Record<typeof riskType, string> = {
      remove_artist: '[移除阵容]',
      reschedule: '[改期]',
      refund: '[全额退款]',
      explain: '[补充说明]',
    }
    setRiskSubmitting(true)
    try {
      await submitActivityRiskResolution(riskTarget.id, {
        userId,
        resolutionNote: `${TYPE_PREFIX[riskType]} ${riskNote.trim()}`,
      })
      await globalAlert('已提交恢复售票申请，等待平台审核。')
      setRiskTarget(null)
      setRiskNote('')
      setRiskType('explain')
      loadData(page)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '提交失败')
    } finally {
      setRiskSubmitting(false)
    }
  }

  const handleAdminSuspend = async (activity: ActivityEntity) => {
    const reason = await globalPrompt('请输入停售原因（将记录到风险案例并通知主办方）：', '风险停售', '请输入停售原因（必填）')
    if (reason === null) return
    if (!reason.trim()) {
      await globalAlert('停售原因不能为空')
      return
    }
    try {
      await suspendActivityForRisk(activity.id, { userId, reason: reason.trim() })
      await globalAlert('活动已被主动停售，已通知主办方处理。')
      loadData(page)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '停售失败')
    }
  }

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadData(1)
  }

  const downloadVenueApprovalAsset = async (activity: ActivityEntity) => {
    const assetId = parsePrivateAssetRef(activity.venueApprovalFileUrl)
    if (!assetId) return
    const token = getToken()
    if (!token) {
      await globalAlert('登录已失效，请重新登录后下载')
      return
    }

    let objectUrl: string | null = null
    try {
      const response = await fetch(privateAssetDownloadUrl(assetId), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('download failed')
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition')
      const filename = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]
      link.href = objectUrl
      link.download = filename ? decodeURIComponent(filename) : `activity-${activity.id}-venue-proof`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      await globalAlert('场馆审核文件下载失败，请稍后重试')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  if (checkingRole) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!role) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">登录后可查看和管理活动。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  if (!canManageActivities && !canManageTours) {
    return <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">无权限访问</div>
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '活动发布管理' : '我的活动管理'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{isAdmin ? '管理平台活动草稿、补齐配置并处理发布状态。' : '维护自己主办的活动草稿、发布申请与后续上下架。'}</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Link href="/console/activities/new" className="rounded-xl border border-[#ffd0df] bg-white p-4 text-[14px] font-medium text-[#ff1268] hover:bg-[#fff7fb]">
          新建活动草稿
          <span className="mt-1 block text-[12px] font-normal text-[#999]">普通活动或巡演活动都从这里创建，创建后继续补齐站点、场馆审核资料和座位票档。</span>
        </Link>
        {(canManageActivities || canManageTours) && (
          <Link href="/console/tours" className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-[14px] font-medium text-[#1a1a2e] hover:bg-[#fafafa]">
            活动发布/多站点草稿管理
            <span className="mt-1 block text-[12px] font-normal text-[#999]">进入已创建的普通活动草稿和巡演/多站点草稿，补齐场馆审核资料、SeatCraft 座位票档和发布配置。</span>
          </Link>
        )}
      </div>

      <form onSubmit={handleSearch} className="mb-5 grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索活动名称"
            className="h-10 w-full rounded-lg border border-[#e5e5e5] pl-9 pr-3 text-[14px] outline-none focus:border-[#ff1268]"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
        >
          <option value="">全部状态</option>
          <option value="1">上架</option>
          <option value="0">下架</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#1a1a2e] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a42]"
        >
          查询
        </button>
      </form>

      {loading ? (
        <div className="text-center text-[#999] py-20 text-[14px]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">
          <div>{error}</div>
          <button
            onClick={() => loadData(page)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#ff1268] px-4 py-2 text-white"
          >
            <RefreshCw className="h-4 w-4" /> 重试
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无匹配活动，可调整筛选条件或点击上方新建活动草稿。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="text-left p-3 font-medium text-[#666]">活动类型</th>
                <th className="text-left p-3 font-medium text-[#666]">活动名称</th>
                <th className="text-left p-3 font-medium text-[#666]">状态</th>
                <th className="text-left p-3 font-medium text-[#666]">创建时间</th>
                <th className="text-center p-3 font-medium text-[#666]">操作</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(a => {
                const rowKey = activityRowKey(a)
                const isTour = a.itemType === 'tour'
                const configHref = isTour ? `/console/tours/${a.id}` : `/console/activities/${a.id}/edit`
                const seatHref = isTour ? `/console/tours/${a.id}?mode=seatcraft` : `/console/sessions?activityId=${a.id}`
                return (
                <tr key={rowKey} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] ${isTour ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#f5f5f5] text-[#666]'}`}>
                      {isTour ? '巡演 / 多站点活动' : '普通活动'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-[#333]">{a.name}</div>
                    {!isTour && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] ${a.realNameRequired ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#f5f5f5] text-[#999]'}`}>
                          {getRealNameRequirementLabel(a.realNameRequired)}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] ${a.ticketTransferAllowed === false ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#f0fff4] text-[#16a34a]'}`}>
                          {getTicketTransferAllowedLabel(a.ticketTransferAllowed)}
                        </span>
                      </div>
                    )}
                    {a.artistName ? <div className="mt-1 text-[12px] font-normal text-[#999]">阵容：{a.artistName}</div> : null}
                  </td>
                  <td className="p-3">
                    <span className={`text-[12px] px-2 py-0.5 rounded-full ${getActivityStatusClass(a)}`}>
                      {getActivityStatusText(a)}
                    </span>
                  </td>
                  <td className="p-3 text-[#999]">{a.createTime?.substring(0, 10)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      {canToggleSaleStatus(a) && (
                        <button
                          onClick={() => handleToggleStatus(a)}
                          className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#666] transition-colors bg-transparent border-none cursor-pointer"
                          title={a.itemType === 'tour' || a.status === 1 ? '下架并退款' : '上架'}
                        >
                          {a.itemType === 'tour' || a.status === 1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                      <Link href={configHref} className="rounded px-2 py-1 text-[12px] text-[#3b82f6] hover:bg-[#eff6ff]">继续配置</Link>
                      <Link href={seatHref} className="rounded px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]">座位票档</Link>
                      {!isTour && (
                        <Link href={`/console/activities/${a.id}/marketing`} className="rounded px-2 py-1 text-[12px] text-[#7c3aed] hover:bg-[#f5f3ff]">营销</Link>
                      )}
                      {canPublishDraft(a) && (
                        <button
                          onClick={() => handlePublishDraft(a)}
                          disabled={publishingKey === rowKey}
                          className="rounded px-2 py-1 text-[12px] text-[#16a34a] hover:bg-[#f0fff4] disabled:text-[#aaa]"
                          title="发布活动草稿"
                        >
                          {publishingKey === rowKey ? '发布中' : '发布'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a)}
                        className="p-1.5 rounded hover:bg-[#fee2e2] text-[#ef4444] transition-colors bg-transparent border-none cursor-pointer"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {a.publishStatus === 'risk_suspended' && (
                        <button
                          onClick={() => handleRiskResolution(a)}
                          className="rounded px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]"
                          title="提交恢复售票申请"
                        >
                          申请恢复
                        </button>
                      )}
                      {parsePrivateAssetRef(a.venueApprovalFileUrl) && (
                        <button
                          onClick={() => downloadVenueApprovalAsset(a)}
                          className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#666] transition-colors bg-transparent border-none cursor-pointer"
                          title="下载场馆审核文件"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      )}
                      {canReviewRisk && isTour && a.publishStatus !== 'draft' && a.status === 1 && (
                        <Link
                          href={`/console/tours/${a.id}?mode=risk`}
                          className="rounded px-2 py-1 text-[12px] text-[#b91c1c] hover:bg-[#fef2f2]"
                          title="风险停售"
                        >
                          风险停售
                        </Link>
                      )}
                      {canReviewRisk && !isTour && a.publishStatus === 'published' && a.status === 1 && (
                        <button
                          onClick={() => handleAdminSuspend(a)}
                          className="rounded px-2 py-1 text-[12px] text-[#b91c1c] hover:bg-[#fef2f2]"
                          title="风险停售"
                        >
                          风险停售
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-[#f0f0f0] px-4 py-3 text-[13px] text-[#666] sm:flex-row sm:items-center sm:justify-between">
            <span>共 {total} 条，当前第 {page} / {pages} 页</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => loadData(page - 1)}
                className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]"
              >
                上一页
              </button>
              <button
                disabled={page >= pages}
                onClick={() => loadData(page + 1)}
                className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
      {riskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[480px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-[18px] font-medium text-[#111]">提交恢复售票申请</h2>
            <p className="mb-4 text-[13px] leading-5 text-[#666]">
              活动：{riskTarget.name}<br />
              请选择处置方式并描述已完成的整改动作，平台审核通过后将恢复售票。
            </p>
            <div className="mb-3">
              <div className="mb-2 text-[13px] text-[#333]">处置方式</div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'remove_artist', label: '移除阵容' },
                    { value: 'reschedule', label: '改期' },
                    { value: 'refund', label: '全额退款' },
                    { value: 'explain', label: '补充说明' },
                  ] as const
                ).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRiskType(option.value)}
                    disabled={riskSubmitting}
                    className="cursor-pointer rounded border bg-white px-3 py-2 text-[13px] outline-none"
                    style={{
                      borderColor: riskType === option.value ? '#ff1268' : '#ddd',
                      color: riskType === option.value ? '#ff1268' : '#666',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={riskNote}
              onChange={(event) => setRiskNote(event.target.value)}
              placeholder="请描述具体处置动作，例如：已下线风险艺人 张三，并向 218 名购票用户发出阵容变更通知。"
              className="mb-4 h-[120px] w-full resize-none rounded border border-[#ddd] px-3 py-2 text-[14px] text-[#333] outline-none focus:border-[#ff1268]"
              maxLength={500}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeRiskDialog}
                disabled={riskSubmitting}
                className="cursor-pointer rounded border border-[#ddd] bg-white px-5 py-2 text-[14px] text-[#666] outline-none"
                style={{ opacity: riskSubmitting ? 0.7 : 1 }}
              >
                取消
              </button>
              <button
                onClick={submitRiskResolution}
                disabled={riskSubmitting}
                className="cursor-pointer rounded border-none bg-[#ff1268] px-5 py-2 text-[14px] text-white outline-none"
                style={{ opacity: riskSubmitting ? 0.7 : 1 }}
              >
                {riskSubmitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
