'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getAdminTourDetail, publishStation } from '@/lib/api'
import type { StationPurchaseDetail, TourAdminDetailVO } from '@/types/api'

type PublishForm = {
  startTime: string
  endTime: string
  perUserLimit: string
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min == null && max == null) return '未公布'
  if (min != null && max != null && min !== max) return `￥${min} - ￥${max}`
  return `￥${min ?? max}`
}

function formatRemainStock(item: StationPurchaseDetail) {
  if (item.remainStock == null && item.saleStatus === 'unannounced') return '未公布'
  return item.remainStock ?? '-'
}

function formatPublishStatus(status: string) {
  const statusText: Record<string, string> = {
    draft: '草稿',
    city_announced: '未公布',
    venue_pending: '场地待审核',
    venue_rejected: '场地审核未通过',
    venue_approved: '待排期发布',
    publishing: '发布中',
    published: '已发布',
    risk_suspended: '暂时停止售票',
    cancelled: '已取消',
  }
  return statusText[status] || status
}

function formatStationStatus(item: StationPurchaseDetail) {
  return item.saleStatusText || formatPublishStatus(item.station.publishStatus)
}

export default function TourDetailPage() {
  const params = useParams<{ id: string }>()
  const tourId = Number(params.id)
  const [detail, setDetail] = useState<TourAdminDetailVO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loginRequired, setLoginRequired] = useState(false)
  const [publishForms, setPublishForms] = useState<Record<number, PublishForm>>({})
  const [publishingStationId, setPublishingStationId] = useState<number | null>(null)

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setLoginRequired(true)
      setLoading(false)
      return
    }
    if (!Number.isInteger(tourId) || tourId <= 0) {
      setError('巡演ID不正确')
      setLoading(false)
      return
    }
    getAdminTourDetail(user.userId, tourId)
      .then(setDetail)
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [tourId])

  const updatePublishForm = (stationId: number, field: keyof PublishForm, value: string) => {
    setPublishForms(prev => ({
      ...prev,
      [stationId]: {
        ...prev[stationId],
        startTime: prev[stationId]?.startTime || '',
        endTime: prev[stationId]?.endTime || '',
        perUserLimit: prev[stationId]?.perUserLimit || '',
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
    if (!form?.startTime || !form.endTime) {
      setError('请填写城市站发布场次时间')
      return
    }
    setError('')
    setPublishingStationId(stationId)
    try {
      await publishStation(stationId, {
        userId: user.userId,
        startTime: form.startTime,
        endTime: form.endTime,
        perUserLimit: form.perUserLimit.trim() ? Number(form.perUserLimit) : null,
      })
      const nextDetail = await getAdminTourDetail(user.userId, tourId)
      setDetail(nextDetail)
      setPublishForms(prev => {
        const next = { ...prev }
        delete next[stationId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败')
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
        <p className="mb-5 text-[14px] text-[#666]">登录后可查看和管理巡演站点。</p>
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
  const publishedCount = stationDetails.filter(item => item.station.publishStatus === 'published').length
  const pendingCount = totalCount - publishedCount

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/console/tours" className="mb-2 inline-flex text-[13px] text-[#666] hover:text-[#ff1268]">返回巡演列表</Link>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{detail.tour.title}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{detail.tour.description || '暂无简介'}</p>
        </div>
        <Link href={`/console/tours/${tourId}/stations/new`} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">新增城市站点</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">站点总数</div>
          <div className="mt-1 text-[26px] font-bold text-[#1a1a2e]">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">已发布数</div>
          <div className="mt-1 text-[26px] font-bold text-[#22c55e]">{publishedCount}</div>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="text-[13px] text-[#999]">待官宣/待审核数</div>
          <div className="mt-1 text-[26px] font-bold text-[#ff1268]">{pendingCount}</div>
        </div>
      </div>

      <div className="space-y-4">
        {stationDetails.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无城市站点，先新增一个站点草稿。</div>
        ) : stationDetails.map(item => {
          const publishForm = publishForms[item.station.id] || { startTime: '', endTime: '', perUserLimit: '' }
          const canPublish = item.station.publishStatus !== 'published' && item.station.venueApplicationId != null
          return <div key={item.station.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[16px] font-bold text-[#333]">{item.station.city} · {item.station.stationName}</div>
                <div className="mt-2 grid gap-1 text-[13px] text-[#666] sm:grid-cols-2">
                  <div>销售状态：{formatStationStatus(item)}</div>
                  <div>发布状态：{formatStationStatus(item)}</div>
                  <div>场馆：{item.venueName || '未公布'}</div>
                  <div>票价：{formatPrice(item.priceMin, item.priceMax)}</div>
                  <div>场次数：{item.sessions.length}</div>
                  <div>剩余库存：{formatRemainStock(item)}</div>
                </div>
              </div>
              <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{item.saleStatusText || '未公布'}</span>
            </div>
            {canPublish && (
              <div className="mt-4 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">发布城市站</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-[13px] text-[#666]">
                    开始时间 *
                    <input type="datetime-local" value={publishForm.startTime} onChange={event => updatePublishForm(item.station.id, 'startTime', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
                  </label>
                  <label className="block text-[13px] text-[#666]">
                    结束时间 *
                    <input type="datetime-local" value={publishForm.endTime} onChange={event => updatePublishForm(item.station.id, 'endTime', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
                  </label>
                  <label className="block text-[13px] text-[#666]">
                    个人限购
                    <input type="number" min={1} value={publishForm.perUserLimit} onChange={event => updatePublishForm(item.station.id, 'perUserLimit', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空不限购" />
                  </label>
                </div>
                <p className="mt-2 text-[12px] text-[#999]">巡演城市站按每个城市站单独限购，不按整轮巡演累计。</p>
                <button onClick={() => handlePublishStation(item.station.id)} disabled={publishingStationId === item.station.id} className="mt-3 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60">
                  {publishingStationId === item.station.id ? '发布中...' : '发布城市站'}
                </button>
              </div>
            )}
          </div>
        })}
      </div>
    </div>
  )
}
