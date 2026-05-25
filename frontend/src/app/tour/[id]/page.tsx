'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getTourDetail } from '@/lib/api'
import type { StationPurchaseDetail, TourDetailVO } from '@/types/api'

function getStationDetails(detail: TourDetailVO) {
  return detail.stationDetails?.length
    ? detail.stationDetails
    : detail.stations.map(station => ({
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
}

function formatStationStatus(item: StationPurchaseDetail) {
  const saleStatusText: Record<string, string> = {
    unannounced: '未公布',
    coming_soon: '即将开售',
    to_be_scheduled: '时间未公布',
    on_sale: '售票中',
    sold_out: '已售罄',
    suspended: '暂停销售',
  }
  const publishStatusText: Record<string, string> = {
    draft: '未公布',
    city_announced: '未公布',
    venue_pending: '待公布',
    venue_rejected: '待公布',
    venue_approved: '待公布',
    publishing: '即将开售',
    published: '已发布',
    risk_suspended: '暂停销售',
    cancelled: '已取消',
  }
  return item.saleStatusText || saleStatusText[item.saleStatus || ''] || publishStatusText[item.station.publishStatus] || '未公布'
}

function isTimeUnannounced(item: StationPurchaseDetail) {
  return item.saleStatus === 'unannounced'
    || item.saleStatus === 'to_be_scheduled'
    || item.station.publishStatus === 'city_announced'
    || item.station.publishStatus === 'draft'
}

function formatDateTime(value?: string | null) {
  if (!value) return '时间未公布'
  return value.slice(0, 16).replace('T', ' ')
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min == null && max == null) return '未公布'
  if (min != null && max != null && min !== max) return `￥${min} - ￥${max}`
  return `￥${min ?? max}`
}

export default function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<TourDetailVO | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationPurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getTourDetail(Number(id)).then(data => {
      if (cancelled) return
      setDetail(data)
      const details = getStationDetails(data)
      setSelectedStation(details[0] || null)
    }).catch(err => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : '加载失败')
    }).finally(() => {
      if (cancelled) return
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const stationDetails = detail ? getStationDetails(detail) : []
  const selectedStatusText = selectedStation ? formatStationStatus(selectedStation) : '未公布'
  const hideStationDetail = selectedStation ? isTimeUnannounced(selectedStation) : false
  const primarySession = selectedStation?.sessions[0]
  const canBuy = selectedStation?.primaryAction === 'buy' && !!selectedStation.activity
  const actionText = hideStationDetail ? '时间未公布' : canBuy ? '立即购票' : selectedStatusText
  const selectedStationPoster = selectedStation?.station.poster || detail?.tour.poster || '/background.png'

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1180px] px-5 py-8">
        {loading ? (
          <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
        ) : error || !detail ? (
          <div className="py-20 text-center text-[14px] text-[#ff1268]">{error || '演出不存在'}</div>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-6 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm lg:grid-cols-[300px_1fr] lg:p-6">
              <div className="overflow-hidden rounded-xl bg-[#f5f5f5]">
                <img src={detail.tour.poster || '/background.png'} alt={detail.tour.title} className="h-[400px] w-full object-cover" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="mb-3 text-[13px] font-medium text-[#ff1268]">巡演详情</div>
                <h1 className="text-[26px] font-semibold leading-tight text-[#111] lg:text-[32px]">{detail.tour.title}</h1>
                <p className="mt-5 text-[14px] leading-7 text-[#666]">{detail.tour.description || '暂无简介'}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-semibold text-[#111]">选择城市</h2>
                <span className="text-[13px] text-[#999]">{stationDetails.length} 个站点</span>
              </div>
              <div className="-mx-5 overflow-x-auto px-5 pb-2 lg:-mx-6 lg:px-6" aria-label="巡演城市站点">
                <div className="flex min-w-max gap-3">
                  {stationDetails.length === 0 ? (
                    <div className="rounded-full bg-[#f7f7f7] px-5 py-3 text-[14px] text-[#999]">暂无站点</div>
                  ) : stationDetails.map(item => {
                    const active = selectedStation?.station.id === item.station.id
                    const stationPoster = item.station.poster || detail.tour.poster || '/background.png'
                    return (
                      <button
                        key={item.station.id}
                        aria-pressed={active}
                        onClick={() => setSelectedStation(item)}
                        className="flex min-w-[190px] items-center gap-3 rounded-2xl border p-2 pr-4 text-left text-[14px] transition"
                        style={{
                          borderColor: active ? '#ff1268' : '#e5e5e5',
                          color: active ? '#ff1268' : '#333',
                          background: active ? '#fff0f5' : '#fff',
                        }}
                      >
                        <img src={stationPoster} alt={item.station.stationName} className="h-10 w-10 rounded-xl object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.station.city}</span>
                          <span className="mt-0.5 block truncate text-[12px] opacity-80">{formatStationStatus(item)}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedStation && (
                <div className="mt-5 rounded-xl bg-[#fafafa] p-5 text-[14px] text-[#555]">
                  <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                    <div className="overflow-hidden rounded-xl bg-[#f0f0f0]">
                      <img src={selectedStationPoster} alt={`${selectedStation.station.city} ${selectedStation.station.stationName}`} className="h-44 w-full object-cover lg:h-full" />
                    </div>
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-[18px] font-semibold text-[#111]">{selectedStation.station.city}</div>
                          <div className="mt-1 text-[13px] text-[#999]">{selectedStation.station.stationName} · {selectedStatusText}</div>
                        </div>
                        <button
                          disabled={!canBuy || hideStationDetail}
                          onClick={() => {
                            if (canBuy && selectedStation.activity) router.push(`/activity/${selectedStation.activity.id}`)
                          }}
                          className="rounded-lg px-5 py-2.5 text-[14px] font-medium disabled:cursor-not-allowed disabled:bg-[#e5e5e5] disabled:text-[#999]"
                          style={canBuy && !hideStationDetail ? { background: '#ff1268', color: '#fff' } : undefined}
                        >
                          {actionText}
                        </button>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">时间</div>
                          <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '时间未公布' : formatDateTime(primarySession?.startTime)}</div>
                        </div>
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">场馆</div>
                          <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : selectedStation.venueName || '未公布'}</div>
                        </div>
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">地址</div>
                          <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : selectedStation.venueAddress || '未公布'}</div>
                        </div>
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">城市</div>
                          <div className="mt-1 font-medium text-[#333]">{selectedStation.station.city}</div>
                        </div>
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">状态</div>
                          <div className="mt-1 font-medium text-[#333]">{selectedStatusText}</div>
                        </div>
                        <div className="rounded-lg bg-white p-4">
                          <div className="text-[12px] text-[#999]">票价</div>
                          <div className="mt-1 font-medium text-[#333]">{hideStationDetail ? '未公布' : formatPrice(selectedStation.priceMin, selectedStation.priceMax)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
