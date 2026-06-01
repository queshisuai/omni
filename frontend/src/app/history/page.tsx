'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, MapPin, Trash2, UserRound } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ACTIVITY_VIEW_SIGNAL_KEY, parseActivityViewSignals, type ActivityViewSignal } from '@/lib/personalized-recommendations'

function formatTime(value?: string | null) {
  if (!value) return '刚刚浏览'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚浏览'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function HistoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<ActivityViewSignal[]>([])

  useEffect(() => {
    setItems(parseActivityViewSignals(localStorage.getItem(ACTIVITY_VIEW_SIGNAL_KEY)))
  }, [])

  const visibleItems = useMemo(() => items.filter(item => item.activityId), [items])

  const clearHistory = () => {
    localStorage.removeItem(ACTIVITY_VIEW_SIGNAL_KEY)
    setItems([])
  }

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100vh-200px)] max-w-[1200px] px-5 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-medium text-[#111]">浏览记录</h1>
            <p className="mt-1 text-[13px] text-[#999]">按最近浏览顺序保存当前设备上的演出记录。</p>
          </div>
          <button
            type="button"
            onClick={clearHistory}
            disabled={visibleItems.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded border border-[#ef4444] bg-white px-4 text-[13px] text-[#ef4444] outline-none disabled:cursor-not-allowed disabled:border-[#ddd] disabled:text-[#bbb]"
          >
            <Trash2 className="h-4 w-4" />
            清空记录
          </button>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-lg border border-[#eee] bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f5]">
              <Clock3 className="h-5 w-5 text-[#999]" />
            </div>
            <p className="text-[14px] text-[#666]">暂无浏览记录</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleItems.map((item) => (
              <button
                key={`${item.activityId}-${item.viewedAt || ''}`}
                type="button"
                onClick={() => router.push(`/activity/${item.activityId}`)}
                className="grid cursor-pointer grid-cols-[88px_minmax(0,1fr)] gap-4 rounded-lg border border-[#eee] bg-white p-4 text-left outline-none transition hover:border-[#ff1268]/40 hover:shadow-[0_8px_24px_rgba(255,18,104,0.08)] sm:grid-cols-[104px_minmax(0,1fr)_auto]"
              >
                <img
                  src={item.poster || '/background.png'}
                  alt={item.title || '演出海报'}
                  className="h-[116px] w-[88px] rounded object-cover sm:h-[138px] sm:w-[104px]"
                />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[17px] font-medium leading-6 text-[#111]">{item.title || `演出 ${item.activityId}`}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[13px] text-[#777]">
                    {item.category && <span className="rounded bg-[#f7f7f7] px-2 py-1">{item.category}</span>}
                    {item.city && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#f7f7f7] px-2 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.city}
                      </span>
                    )}
                    {item.artist && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#f7f7f7] px-2 py-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {item.artist}
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-1 text-[12px] text-[#999] sm:col-span-1 sm:justify-self-end">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatTime(item.viewedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
