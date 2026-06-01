'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, Heart, Loader2, MapPin, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { cancelSubscription, createSubscription, createSubscriptionCalendar, listSubscriptions } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { formatSubscriptionTargetType, formatSubscriptionTime, getCountdownText } from '@/lib/subscription'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import type { SubscriptionTargetType, SubscriptionVO } from '@/types/api'

type TabKey = 'all' | 'want' | 'reminder' | 'follow'

const TAB_META: Array<{ key: TabKey; label: string; types?: SubscriptionTargetType[] }> = [
  { key: 'all', label: '全部' },
  { key: 'want', label: '想看', types: ['ACTIVITY_WANT'] },
  { key: 'reminder', label: '提醒', types: ['SALE_REMINDER', 'WAITLIST_REMINDER', 'TOUR_CITY_REMINDER'] },
  { key: 'follow', label: '关注', types: ['ARTIST_FOLLOW', 'CITY_FOLLOW'] },
]

function typeIcon(type: SubscriptionTargetType) {
  const normalized = String(type).toUpperCase()
  if (normalized === 'ACTIVITY_WANT') return <Heart className="h-4 w-4" />
  if (normalized === 'ARTIST_FOLLOW') return <UserRound className="h-4 w-4" />
  if (normalized === 'CITY_FOLLOW' || normalized === 'TOUR_CITY_REMINDER') return <MapPin className="h-4 w-4" />
  return <Bell className="h-4 w-4" />
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function SubscriptionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<SubscriptionVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [city, setCity] = useState('')
  const [savingCity, setSavingCity] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadData = () => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/subscriptions')
      return
    }
    setLoading(true)
    setError('')
    listSubscriptions()
      .then(data => setItems(data || []))
      .catch(err => setError(err instanceof Error ? err.message : '加载想看与提醒失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [router])

  const filtered = useMemo(() => {
    const tab = TAB_META.find(item => item.key === activeTab)
    if (!tab?.types) return items
    return items.filter(item => tab.types?.includes(String(item.targetType).toUpperCase()))
  }, [activeTab, items])

  const addCityFollow = async () => {
    const normalizedCity = city.trim()
    if (!normalizedCity) {
      await globalAlert('请输入要关注的城市')
      return
    }
    setSavingCity(true)
    try {
      await createSubscription({ targetType: 'CITY_FOLLOW', city: normalizedCity })
      setCity('')
      loadData()
      await globalAlert('城市关注已添加')
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '添加城市关注失败')
    } finally {
      setSavingCity(false)
    }
  }

  const downloadCalendar = async () => {
    setCalendarLoading(true)
    try {
      const data = await createSubscriptionCalendar()
      downloadTextFile(data.fileName, data.content)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '生成日历失败')
    } finally {
      setCalendarLoading(false)
    }
  }

  const removeItem = async (item: SubscriptionVO) => {
    if (!(await globalConfirm('确认取消这条想看或提醒吗？'))) return
    setDeletingId(item.id)
    try {
      await cancelSubscription(item.id)
      setItems(prev => prev.filter(current => current.id !== item.id))
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '取消失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100vh-200px)] w-full max-w-[1200px] px-5 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-[24px] font-medium text-[#111]">想看与提醒</h1>
            <p className="mt-2 text-[13px] text-[#666]">管理演出想看、开售提醒、候补提醒、艺人和城市关注。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadCalendar}
              disabled={calendarLoading}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-white px-4 text-[14px] text-[#ff1268] outline-none hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {calendarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              导出日历
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 text-[14px] text-[#555] outline-none hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-lg border border-[#eee] bg-white p-4 sm:grid-cols-[1fr_auto]">
          <label className="block text-[13px] text-[#333]">
            关注城市
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="例如：上海"
              className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]"
            />
          </label>
          <button
            onClick={addCityFollow}
            disabled={savingCity}
            className="inline-flex h-10 self-end cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-[#ff1268] px-4 text-[14px] font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingCity ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            添加关注
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#e5e5e5] pb-3">
          {TAB_META.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 cursor-pointer rounded-lg border px-4 text-[13px] outline-none transition-colors ${
                activeTab === tab.key
                  ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]'
                  : 'border-[#e5e5e5] bg-white text-[#666] hover:bg-[#fafafa]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[#eee] bg-white text-[14px] text-[#666]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-[#eee] bg-white px-6 py-16 text-center text-[14px] text-[#999]">
            暂无想看或提醒，可在活动详情页添加。
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(item => (
              <div key={item.id} className="rounded-lg border border-[#eee] bg-white p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-[88px_1fr_auto]">
                  <img
                    src={item.activityPoster || '/background.png'}
                    alt={item.activityName || item.targetName || '演出海报'}
                    className="h-[118px] w-[88px] rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f5] px-3 py-1 text-[12px] text-[#ff1268]">
                        {typeIcon(item.targetType)}
                        {formatSubscriptionTargetType(item.targetType)}
                      </span>
                      <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">{item.saleStatusText || '待公布'}</span>
                    </div>
                    <button
                      onClick={() => item.activityId && router.push(`/activity/${item.activityId}`)}
                      className="block max-w-full truncate border-none bg-transparent p-0 text-left text-[17px] font-semibold text-[#111] outline-none hover:text-[#ff1268]"
                    >
                      {item.activityName || item.targetName || item.city || '未命名订阅'}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#666]">
                      <span>{formatSubscriptionTime(item.startTime)}</span>
                      <span>{getCountdownText(item.startTime)}</span>
                      {item.venueName && <span>{item.venueName}</span>}
                      {item.city && <span>{item.city}</span>}
                      {item.artistName && <span>{item.artistName}</span>}
                    </div>
                    {item.readyChecklist && item.readyChecklist.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.readyChecklist.map((text, index) => (
                          <span key={`${item.id}-${index}`} className="rounded-lg bg-[#fafafa] px-3 py-1.5 text-[12px] text-[#666]">{text}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item)}
                    disabled={deletingId === item.id}
                    className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 text-[14px] text-[#666] outline-none hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60 md:w-[112px]"
                  >
                    {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    取消
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
