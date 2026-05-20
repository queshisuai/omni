'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getTourDetail } from '@/lib/api'
import type { StationPurchaseDetail, TourDetailVO } from '@/types/api'

export default function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<TourDetailVO | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationPurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTourDetail(Number(id)).then(data => {
      setDetail(data)
      const details = data.stationDetails?.length
        ? data.stationDetails
        : data.stations.map(station => ({ station, activity: null, sessions: [] }))
      setSelectedStation(details[0] || null)
    }).catch(err => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1180px] px-5 py-8">
        {loading ? (
          <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
        ) : error || !detail ? (
          <div className="py-20 text-center text-[14px] text-[#ff1268]">{error || '演出不存在'}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
              <img src={detail.tour.poster || '/background.png'} alt={detail.tour.title} className="h-[400px] w-full object-cover" />
            </div>
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-6">
              <h1 className="mb-3 text-[26px] font-semibold text-[#111]">{detail.tour.title}</h1>
              {detail.tour.description && <p className="mb-6 text-[14px] leading-7 text-[#666]">{detail.tour.description}</p>}
              <div className="mb-5 flex flex-wrap gap-3">
                {detail.stations.length === 0 ? (
                  <div className="rounded-lg bg-[#f7f7f7] px-4 py-3 text-[14px] text-[#999]">暂无站点</div>
                ) : (detail.stationDetails?.length ? detail.stationDetails : detail.stations.map(station => ({ station, activity: null, sessions: [] }))).map(item => (
                  <button
                    key={item.station.id}
                    onClick={() => setSelectedStation(item)}
                    className="rounded-lg border px-4 py-2 text-[14px]"
                    style={{
                      borderColor: selectedStation?.station.id === item.station.id ? '#ff1268' : '#e5e5e5',
                      color: selectedStation?.station.id === item.station.id ? '#ff1268' : '#333',
                      background: selectedStation?.station.id === item.station.id ? '#fff0f5' : '#fff',
                    }}
                  >
                    {item.station.city} · {item.station.stationName}
                  </button>
                ))}
              </div>
              {selectedStation && (
                <div className="rounded-xl bg-[#fafafa] p-5 text-[14px] text-[#555]">
                  <div className="mb-2 text-[18px] font-medium text-[#111]">{selectedStation.station.stationName}</div>
                  <div>城市：{selectedStation.station.city}</div>
                  <div className="mt-1">发布状态：{selectedStation.station.publishStatus}</div>
                  {selectedStation.activity && selectedStation.sessions.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {selectedStation.sessions.map(session => (
                        <div key={session.id} className="rounded-lg border border-[#e5e5e5] bg-white p-4">
                          <div className="text-[15px] font-medium text-[#111]">
                            {session.startTime?.slice(0, 16).replace('T', ' ')}
                          </div>
                          <div className="mt-1 text-[12px] text-[#999]">场次 ID：{session.id}</div>
                          <button
                            onClick={() => router.push(`/activity/${selectedStation.activity?.id}`)}
                            className="mt-3 rounded bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white"
                          >
                            选择票档并购买
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-[13px] text-[#999]">该站点尚未发布可售场次。</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
