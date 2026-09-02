'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { SafeImage } from '@/components/SafeImage'
import { getUser } from '@/lib/auth'
import { getAdminTourDetail, publishStation } from '@/lib/api'
import type { StationPurchaseDetail, TourAdminDetailVO } from '@/types/api'

type PublishForm = {
  startTime: string
  endTime: string
  perUserLimit: string
  scheduleTba: boolean
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min == null && max == null) return '未公布'
  if (min != null && max != null && min !== max) return `￥${min} - ￥${max}`
  return `￥${min ?? max}`
}

function formatStationPrice(item: StationPurchaseDetail) {
  if (item.saleStatus === 'ticket_tba') return '票档待公布'
  return formatPrice(item.priceMin, item.priceMax)
}

function formatRemainStock(item: StationPurchaseDetail) {
  if (item.remainStock == null && item.saleStatus === 'unannounced') return '未公布'
  return item.remainStock ?? '-'
}

function formatPublishStatus(status: string) {
  const statusText: Record<string, string> = {
    draft: '草稿',
    city_announced: '城市已公布',
    venue_pending: '场地待审核',
    venue_rejected: '场地审核未通过',
    venue_approved: '待排期发布',
    publishing: '发布中',
    published: '已发布',
    risk_suspended: '暂时停止售票',
    deactivated: '已下架',
    cancelled: '已取消',
  }
  return statusText[status] || '未知发布状态'
}

function formatStationStatus(item: StationPurchaseDetail) {
  return item.saleStatusText || formatPublishStatus(item.station.publishStatus)
}

function formatConfigStatus(status?: string | null) {
  const statusText: Record<string, string> = {
    draft: '配置草稿',
    submitted: '配置待审核',
    applied: '配置已应用',
    rejected: '配置已驳回',
    withdrawn: '配置已撤回',
  }
  return status ? statusText[status] || '未知配置状态' : '暂无配置版本'
}

function isCityPublishedStatus(status?: string | null) {
  return Boolean(status && !['draft', 'cancelled', 'deactivated'].includes(status))
}

function needsVenueReview(item: StationPurchaseDetail) {
  if (!isCityPublishedStatus(item.station.publishStatus) || item.station.publishStatus === 'published') return false
  return item.station.venueApplicationId == null
    || ['city_announced', 'venue_pending', 'venue_rejected'].includes(item.station.publishStatus)
}

export default function TourDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const tourId = Number(params.id)
  const [detail, setDetail] = useState<TourAdminDetailVO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loginRequired, setLoginRequired] = useState(false)
  const [publishForms, setPublishForms] = useState<Record<number, PublishForm>>({})
  const [publishErrors, setPublishErrors] = useState<Record<number, string>>({})
  const [publishingStationId, setPublishingStationId] = useState<number | null>(null)

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setLoginRequired(true)
      setLoading(false)
      return
    }
    if (!Number.isInteger(tourId) || tourId <= 0) {
      setError('巡演编号不正确')
      setLoading(false)
      return
    }
    getAdminTourDetail(user.userId, tourId)
      .then(setDetail)
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [tourId])

  const updatePublishForm = (stationId: number, field: keyof PublishForm, value: string | boolean) => {
    setPublishForms(prev => ({
      ...prev,
      [stationId]: {
        ...prev[stationId],
        startTime: prev[stationId]?.startTime || '',
        endTime: prev[stationId]?.endTime || '',
        perUserLimit: prev[stationId]?.perUserLimit || '',
        scheduleTba: prev[stationId]?.scheduleTba || false,
        [field]: value,
      },
    }))
  }

  const handlePublishStation = async (stationId: number) => {
    const user = getUser()
    if (!user) {
      setLoginRequired(true)
      return
    }
    const form = publishForms[stationId]
    if (!form?.scheduleTba && (!form?.startTime || !form.endTime)) {
      setPublishErrors(prev => ({ ...prev, [stationId]: '请填写城市站发布场次时间' }))
      return
    }
    const limitText = form.perUserLimit.trim()
    if (limitText && (!/^\d+$/.test(limitText) || Number(limitText) <= 0)) {
      setPublishErrors(prev => ({ ...prev, [stationId]: '个人限购张数必须为正整数' }))
      return
    }
    setPublishErrors(prev => {
      const next = { ...prev }
      delete next[stationId]
      return next
    })
    setPublishingStationId(stationId)
    try {
      await publishStation(stationId, {
        userId: user.userId,
        scheduleTba: form.scheduleTba,
        startTime: form.scheduleTba ? null : form.startTime,
        endTime: form.scheduleTba ? null : form.endTime,
        perUserLimit: limitText ? Number(limitText) : null,
      })
      const nextDetail = await getAdminTourDetail(user.userId, tourId)
      setDetail(nextDetail)
      setPublishForms(prev => {
        const next = { ...prev }
        delete next[stationId]
        return next
      })
    } catch (err) {
      setPublishErrors(prev => ({ ...prev, [stationId]: err instanceof Error ? err.message : '发布失败' }))
    } finally {
      setPublishingStationId(null)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (loginRequired) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">登录状态已失效，请重新登录后再查看和管理巡演站点。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  if (error || !detail) {
    return <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error || '加载失败'}</div>
  }

  const stationDetails = detail.stationDetails?.length ? detail.stationDetails : detail.stations.map(station => ({
    station,
    activity: null,
    sessions: [],
    venueName: null,
    venueAddress: null,
    priceMin: null,
    priceMax: null,
    remainStock: null,
    saleStatus: 'unannounced',
    saleStatusText: '未公布',
    primaryAction: 'none',
  } satisfies StationPurchaseDetail))
  const totalCount = stationDetails.length
  const publishedCount = stationDetails.filter(item => isCityPublishedStatus(item.station.publishStatus)).length
  const pendingCount = stationDetails.filter(needsVenueReview).length
  const publishMode = searchParams.get('mode') === 'publish'
  const seatcraftMode = searchParams.get('mode') === 'seatcraft'
  const riskMode = searchParams.get('mode') === 'risk'

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/console/tours" className="mb-2 inline-flex text-[13px] text-[#666] hover:text-[#ff1268]">返回巡演草稿列表</Link>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{detail.tour.title}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{detail.tour.description || '暂无简介'} · 城市发布后可继续添加场馆，上传场馆审核资料并通过审核后再配置场次和票档。</p>
          {publishMode && (
            <div className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#f0fff4] px-3 py-2 text-[13px] text-[#166534]">
              请选择具体城市站发布。若站点未显示发布表单，请先为该站点添加场馆并提交场馆资料，等待平台审核通过。
            </div>
          )}
          {seatcraftMode && (
            <div className="mt-3 rounded-lg border border-[#ffd0df] bg-[#fff7fb] px-3 py-2 text-[13px] text-[#9f1239]">
              巡演活动的座位票档按城市站点配置。请选择下方具体城市站点进入“座位票档”。
            </div>
          )}
          {riskMode && (
            <div className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]">
              巡演活动风险停售按已售票城市站点处理。请选择对应城市站点的售票活动后执行停售，避免影响未发布站点。
            </div>
          )}
        </div>
        <Link href={`/console/tours/${tourId}/stations/new`} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">新增城市站点</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">站点总数</div>
          <div className="mt-1 text-[26px] font-bold text-[#1a1a2e]">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">已发布城市数</div>
          <div className="mt-1 text-[26px] font-bold text-[#22c55e]">{publishedCount}</div>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">待添加/审核场馆数</div>
          <div className="mt-1 text-[26px] font-bold text-[#ff1268]">{pendingCount}</div>
        </div>
      </div>

      <div className="space-y-4">
        {stationDetails.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无城市站点，先新增一个站点草稿。</div>
        ) : stationDetails.map(item => {
          const posterUrl = item.station.poster || detail.tour.poster
          const stationName = item.station.stationName || (item.station.city ? `${item.station.city}站` : '未命名站点')
          const stationCity = item.station.city || '城市待定'
          const stationConfigStatus = formatConfigStatus((item.station as { configStatus?: string | null }).configStatus)
          const stationConfigVersionNo = (item.station as { configVersionNo?: number | null }).configVersionNo
          const publishForm = publishForms[item.station.id] || { startTime: '', endTime: '', perUserLimit: '', scheduleTba: false }
          const publishError = publishErrors[item.station.id]
          const canPublish = item.station.publishStatus !== 'published' && item.station.venueApplicationId != null
          const needsVenueBeforeSale = item.station.publishStatus !== 'published' && item.station.venueApplicationId == null
          return <div key={item.station.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                <SafeImage src={posterUrl} alt={stationName} className="h-32 w-full rounded-xl object-cover sm:w-48" />
                <div>
                  <div className="text-[16px] font-bold text-[#333]">{stationCity} · {stationName}</div>
                  <div className="mt-2 grid gap-1 text-[13px] text-[#666] sm:grid-cols-2">
                    <div>销售状态：{formatStationStatus(item)}</div>
                    <div>发布状态：{formatPublishStatus(item.station.publishStatus)}</div>
                    <div>场馆：{item.venueName || '未公布'}</div>
                    <div>票价：{formatStationPrice(item)}</div>
                    <div>场次数：{item.sessions.length}</div>
                    <div>剩余库存：{formatRemainStock(item)}</div>
                    <div>配置状态：{stationConfigStatus}</div>
                    <div>配置版本：{stationConfigVersionNo ? `v${stationConfigVersionNo}` : '暂无'}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/console/stations/${item.station.id}/seatcraft`} className="rounded-lg border border-[#ffd0df] px-3 py-1.5 text-[12px] font-medium text-[#ff1268] hover:bg-[#fff0f5]">座位票档</Link>
                    <Link href={`/console/tours/${tourId}/stations/${item.station.id}/venue`} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-[12px] text-[#666] hover:bg-[#fafafa]">添加场馆</Link>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{item.saleStatusText || '未公布'}</span>
            </div>
            {canPublish && (
              <div className="mt-4 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">发布城市站</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-start gap-2 rounded-lg bg-white p-3 text-[13px] text-[#333] sm:col-span-3">
                    <input type="checkbox" checked={publishForm.scheduleTba} onChange={event => updatePublishForm(item.station.id, 'scheduleTba', event.target.checked)} className="mt-0.5" />
                    <span><span className="font-medium">场次时间待公布</span>：先发布城市站和场馆，暂不展示具体时间、票价和购买入口。</span>
                  </label>
                  <label className="block text-[13px] text-[#666]">
                    开始时间 *
                    <input type="datetime-local" value={publishForm.startTime} disabled={publishForm.scheduleTba} onChange={event => updatePublishForm(item.station.id, 'startTime', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
                  </label>
                  <label className="block text-[13px] text-[#666]">
                    结束时间 *
                    <input type="datetime-local" value={publishForm.endTime} disabled={publishForm.scheduleTba} onChange={event => updatePublishForm(item.station.id, 'endTime', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
                  </label>
                  <label className="block text-[13px] text-[#666]">
                    个人限购
                    <input type="number" min={1} value={publishForm.perUserLimit} onChange={event => updatePublishForm(item.station.id, 'perUserLimit', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空不限购" />
                  </label>
                </div>
                <p className="mt-2 text-[12px] text-[#999]">巡演城市站按每个城市站单独限购，不按整轮巡演累计。</p>
                {publishError && <div className="mt-3 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{publishError}</div>}
                <button onClick={() => handlePublishStation(item.station.id)} disabled={publishingStationId === item.station.id} className="mt-3 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60">
                  {publishingStationId === item.station.id ? '发布中...' : '发布城市站'}
                </button>
              </div>
            )}
            {needsVenueBeforeSale && (
              <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-[13px] text-[#92400e]">
                城市站已发布：前台会展示该城市站点，场馆、时间、票价和购票入口显示为待公布。后续添加场馆并通过场馆审核资料核验后，可继续配置场次和票档。
              </div>
            )}
          </div>
        })}
      </div>
    </div>
  )
}
