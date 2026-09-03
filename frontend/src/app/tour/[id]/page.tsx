'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Clock3, Heart, MapPin, Plus, Search, ShieldCheck, UserCheck, UserRound, X } from 'lucide-react'
import { Header, HOT_CITIES, OTHER_CITIES } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { FloatingBackButton } from '@/components/FloatingBackButton'
import { SafeImage } from '@/components/SafeImage'
import { cancelSubscription, createSubscription, getTourDetail, listSubscriptions } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { ALL_CITY_VALUE, CITY_KEY, filterCityOptions } from '@/lib/city-selection'
import type { StationPurchaseDetail, SubscriptionVO, TourDetailVO } from '@/types/api'

type TourStationState = 'ACTIVE' | 'RESERVING' | 'PENDING' | 'SOLD_OUT'
type TourAction = 'TOUR_CITY_REMINDER' | 'ARTIST_FOLLOW'

const CITY_INITIAL_BUCKETS: Record<string, string> = {
  A: '阿安鞍澳',
  B: '巴白百保宝包北本蚌毕滨博亳',
  C: '沧长常昌朝潮郴承赤池重崇楚滁',
  D: '大达丹儋德迪定东',
  E: '鄂恩',
  F: '佛抚阜福',
  G: '甘赣高固广贵桂',
  H: '哈海邯汉杭鹤河合和菏贺黑衡红呼葫湖淮怀黄惠',
  J: '吉济鸡佳嘉江焦揭晋金锦景荆九酒',
  K: '喀开克昆',
  L: '兰廊拉乐凉连聊辽丽临林六柳陇龙娄漯洛泸吕',
  M: '马茂眉梅绵牡',
  N: '南内宁怒',
  P: '盘攀平萍莆濮',
  Q: '齐黔潜钦秦青庆清泉曲衢',
  R: '日',
  S: '三商上山汕韶绍邵神沈深十石双朔四松绥随遂苏宿',
  T: '塔泰台太唐天铁铜通吐',
  W: '威潍渭文温乌无吴梧芜武',
  X: '西项香湘襄咸孝锡兴邢新信忻宣许徐',
  Y: '雅延盐阳扬烟宜伊银营鹰益永岳榆玉运云',
  Z: '枣张漳湛肇昭郑镇中周舟珠驻株淄自资遵',
}

const CITY_GROUP_LETTERS = Object.keys(CITY_INITIAL_BUCKETS)

function normalizeWishCity(city: string) {
  return city.trim().replace(/市$/, '')
}

function formatLocationCity(city: string) {
  const normalized = normalizeWishCity(city)
  if (!normalized || normalized === ALL_CITY_VALUE) return '佛山市'
  return /[市州盟县区]$/.test(normalized) ? normalized : `${normalized}市`
}

function getCityInitial(city: string) {
  const firstChar = Array.from(city.trim())[0]
  if (!firstChar) return 'Z'
  return CITY_GROUP_LETTERS.find(letter => CITY_INITIAL_BUCKETS[letter].includes(firstChar)) || 'Z'
}

function buildCityGroups(cities: string[]) {
  const uniqueCities = Array.from(new Set(cities.map(normalizeWishCity).filter(Boolean)))
  const sortedCities = uniqueCities.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
  return CITY_GROUP_LETTERS.map(letter => ({
    letter,
    cities: sortedCities.filter(city => getCityInitial(city) === letter),
  })).filter(group => group.cities.length > 0)
}

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

function getStationTitle(item: StationPurchaseDetail) {
  const title = item.station.stationName || item.station.city || '城市待定'
  return title.includes('站') ? title : `${title}站`
}

function getStationCity(item?: StationPurchaseDetail | null) {
  return item?.station.city || item?.station.stationName?.replace(/站$/, '') || '城市待定'
}

function getStationSessionTime(session?: StationPurchaseDetail['sessions'][number]) {
  if (!session) return null
  return 'session' in session ? session.session.startTime : session.startTime
}

function formatDateTime(value?: string | null) {
  if (!value) return '时间待公布'
  return value.slice(0, 16).replace('T', ' ')
}

function formatStationDate(item: StationPurchaseDetail) {
  const dates = item.sessions
    .map(getStationSessionTime)
    .filter(Boolean)
    .map(value => {
      const matched = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
      return matched ? { month: Number(matched[2]), day: Number(matched[3]) } : null
    })
    .filter((value): value is { month: number; day: number } => Boolean(value))

  if (!dates.length) return '时间待定'
  const [first, ...rest] = dates
  return [`${first.month}.${String(first.day).padStart(2, '0')}`, ...rest.map(item => (
    item.month === first.month ? String(item.day).padStart(2, '0') : `${item.month}.${String(item.day).padStart(2, '0')}`
  ))].join(' / ')
}

function formatTourTitle(title: string) {
  return title.includes('巡回演唱会') ? title : `${title} · 巡回演唱会`
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min == null && max == null) return '票价待公布'
  if (min != null && max != null && min !== max) return `¥${min} - ¥${max}`
  return `¥${min ?? max}`
}

function getStationState(item: StationPurchaseDetail): TourStationState {
  const saleStatus = String(item.saleStatus || '').toLowerCase()
  const publishStatus = String(item.station.publishStatus || '').toLowerCase()
  if (saleStatus === 'sold_out') return 'SOLD_OUT'
  if (saleStatus === 'on_sale' || item.primaryAction === 'buy') {
    return item.remainStock === 0 ? 'SOLD_OUT' : 'ACTIVE'
  }
  if (saleStatus === 'coming_soon') return 'RESERVING'
  if (['draft', 'city_announced', 'venue_pending', 'venue_rejected', 'venue_approved'].includes(publishStatus)) return 'PENDING'
  return 'PENDING'
}

function getStationStatusMeta(item: StationPurchaseDetail) {
  const state = getStationState(item)
  if (state === 'ACTIVE') return { text: '售票中', className: 'bg-[#10B981] text-white' }
  if (state === 'RESERVING') return { text: '预约中', className: 'bg-[#F59E0B] text-white' }
  if (state === 'SOLD_OUT') return { text: '缺货登记', className: 'bg-[#9CA3AF] text-white' }
  return { text: '待公布', className: 'bg-[#9CA3AF] text-white' }
}

function sameId(left: number | string | null | undefined, right: number | string | null | undefined) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
}

function isActiveSubscription(subscription: SubscriptionVO) {
  return Number(subscription.status ?? 1) === 1
}

function findTourCitySubscription(subscriptions: SubscriptionVO[], tourId: number, station?: StationPurchaseDetail | null) {
  return findTourCitySubscriptionByCity(subscriptions, tourId, getStationCity(station))
}

function findTourCitySubscriptionByCity(subscriptions: SubscriptionVO[], tourId: number, city: string) {
  const normalizedCity = normalizeWishCity(city)
  return subscriptions.find(subscription => (
    isActiveSubscription(subscription)
    && String(subscription.targetType).toUpperCase() === 'TOUR_CITY_REMINDER'
    && sameId(subscription.targetId, tourId)
    && (normalizeWishCity(subscription.city || '') === normalizedCity || normalizeWishCity(subscription.targetValue || '') === normalizedCity)
  )) ?? null
}

function findArtistSubscription(subscriptions: SubscriptionVO[], artistId?: number | null) {
  if (!artistId) return null
  return subscriptions.find(subscription => (
    isActiveSubscription(subscription)
    && String(subscription.targetType).toUpperCase() === 'ARTIST_FOLLOW'
    && (sameId(subscription.artistId, artistId) || sameId(subscription.targetId, artistId))
  )) ?? null
}

export default function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<TourDetailVO | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationPurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscriptions, setSubscriptions] = useState<SubscriptionVO[]>([])
  const [actionLoading, setActionLoading] = useState<TourAction | null>(null)
  const [centerToast, setCenterToast] = useState<{ id: number; message: string } | null>(null)
  const [showEncoreCityModal, setShowEncoreCityModal] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [currentLocationCity, setCurrentLocationCity] = useState('佛山市')
  const [encoreSubmittingCity, setEncoreSubmittingCity] = useState('')
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getTourDetail(Number(id)).then(data => {
      if (cancelled) return
      const stations = getStationDetails(data)
      setDetail(data)
      setSelectedStation(stations[0] || null)
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

  useEffect(() => {
    if (!isAuthenticated()) {
      setSubscriptions([])
      return
    }
    let cancelled = false
    listSubscriptions()
      .then(data => {
        if (!cancelled) setSubscriptions(data || [])
      })
      .catch(() => {
        if (!cancelled) setSubscriptions([])
      })
    return () => {
      cancelled = true
    }
  }, [detail?.tour.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setCurrentLocationCity(formatLocationCity(window.localStorage.getItem(CITY_KEY) || '佛山'))
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [])

  const showCenterToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setCenterToast({ id: Date.now(), message })
    toastTimerRef.current = window.setTimeout(() => {
      setCenterToast(null)
      toastTimerRef.current = null
    }, 1500)
  }

  const requireLogin = () => {
    if (isAuthenticated()) return true
    router.push(`/login?ru=/tour/${id}`)
    return false
  }

  const upsertSubscription = (subscription: SubscriptionVO) => {
    setSubscriptions(current => [subscription, ...current.filter(item => item.id !== subscription.id)])
  }

  const removeSubscription = (subscriptionId: number) => {
    setSubscriptions(current => current.filter(item => item.id !== subscriptionId))
  }

  const handleTourCityReminder = async (messages: { success: string; cancel?: string; keepWhenActive?: boolean }) => {
    if (!detail || !selectedStation || !requireLogin()) return
    const existing = findTourCitySubscription(subscriptions, detail.tour.id, selectedStation)
    if (existing && messages.keepWhenActive) {
      showCenterToast(messages.success)
      return
    }
    if (actionLoading) return
    setActionLoading('TOUR_CITY_REMINDER')
    try {
      if (existing) {
        await cancelSubscription(existing.id)
        removeSubscription(existing.id)
        showCenterToast(messages.cancel || '已关闭开售提醒')
        return
      }
      const city = getStationCity(selectedStation)
      const subscription = await createSubscription({
        targetType: 'TOUR_CITY_REMINDER',
        targetId: detail.tour.id,
        targetValue: city,
        city,
      })
      upsertSubscription(subscription)
      showCenterToast(messages.success)
    } catch (err) {
      showCenterToast(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const closeEncoreCityModal = () => {
    setShowEncoreCityModal(false)
    setCitySearch('')
  }

  const submitEncoreCityWish = async (city: string) => {
    if (!detail) return
    const normalizedCity = normalizeWishCity(city)
    if (!normalizedCity) {
      showCenterToast('请选择想看的城市')
      return
    }
    if (!requireLogin()) {
      closeEncoreCityModal()
      return
    }
    if (encoreSubmittingCity) return
    setEncoreSubmittingCity(normalizedCity)
    try {
      const subscription = await createSubscription({
        targetType: 'TOUR_CITY_REMINDER',
        targetId: detail.tour.id,
        targetValue: normalizedCity,
        city: normalizedCity,
      })
      upsertSubscription(subscription)
      closeEncoreCityModal()
      showCenterToast(`已提交【${city}】加场心愿，主办方会收到您的期待！`)
    } catch (err) {
      showCenterToast(err instanceof Error ? err.message : '加场心愿提交失败')
    } finally {
      setEncoreSubmittingCity('')
    }
  }

  const handleArtistFollow = async () => {
    if (!detail || !requireLogin()) return
    if (!detail.tour.artistId) {
      showCenterToast('当前巡演暂无可关注艺人')
      return
    }
    if (actionLoading) return
    const existing = findArtistSubscription(subscriptions, detail.tour.artistId)
    setActionLoading('ARTIST_FOLLOW')
    try {
      if (existing) {
        await cancelSubscription(existing.id)
        removeSubscription(existing.id)
        showCenterToast('已取消关注')
        return
      }
      const subscription = await createSubscription({
        targetType: 'ARTIST_FOLLOW',
        targetId: detail.tour.artistId,
        artistId: detail.tour.artistId,
      })
      upsertSubscription(subscription)
      showCenterToast('关注成功')
    } catch (err) {
      showCenterToast(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const stationDetails = detail ? getStationDetails(detail) : []
  const selectedState = selectedStation ? getStationState(selectedStation) : 'PENDING'
  const selectedCityLabel = selectedStation ? getStationTitle(selectedStation) : '城市待定站'
  const selectedSessionTime = formatDateTime(getStationSessionTime(selectedStation?.sessions[0]))
  const cityReminder = detail ? findTourCitySubscription(subscriptions, detail.tour.id, selectedStation) : null
  const cityReminderActive = Boolean(cityReminder)
  const artistFollowActive = Boolean(detail ? findArtistSubscription(subscriptions, detail.tour.artistId) : null)
  const heroPoster = selectedStation?.station.poster || detail?.tour.poster || null
  const cityOptions = useMemo(() => (
    citySearch
      ? filterCityOptions(citySearch, HOT_CITIES, OTHER_CITIES)
      : [...HOT_CITIES, ...OTHER_CITIES]
  ), [citySearch])
  const cityGroups = useMemo(() => buildCityGroups(cityOptions), [cityOptions])

  return (
    <>
      <Header />
      <FloatingBackButton
        analyticsEvent="omni_tour_detail_back_clicked"
        analyticsPayload={{ tour_id: detail?.tour.id ?? Number(id) }}
      />
      <main className="bg-[#F8F9FA] px-5 py-8">
        <div className="mx-auto max-w-[1200px]">
          {loading ? (
            <div className="rounded-2xl bg-white py-20 text-center text-[14px] text-[#999] shadow-[0_4px_12px_rgba(0,0,0,0.03)]">加载中...</div>
          ) : error || !detail ? (
            <div className="rounded-2xl bg-white py-20 text-center text-[14px] text-[#ff1268] shadow-[0_4px_12px_rgba(0,0,0,0.03)]">{error || '演出不存在'}</div>
          ) : (
            <section className="rounded-2xl border border-[#eef0f3] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] lg:p-8">
              <div className="grid gap-7 border-b border-[#eef0f3] pb-7 lg:grid-cols-[198px_minmax(0,1fr)]">
                <div className="relative overflow-hidden rounded-2xl bg-[#f3f4f6]">
                  <SafeImage src={heroPoster} alt={detail.tour.title} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[12px] font-medium text-white">巡回演唱会</span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded bg-[#FF1475] px-2.5 py-1 text-[13px] font-semibold text-white">巡演项目</span>
                    <h1 className="text-[26px] font-semibold leading-tight text-[#111]">{formatTourTitle(detail.tour.title)}</h1>
                  </div>
                  <p className="mt-3 max-w-[780px] text-[13px] leading-6 text-[#8a93a3]">
                    {detail.tour.description || '华语乐坛天后将继续携等待五年的巡回演唱会奔赴全国，落日余晖，现场相见。'}
                  </p>
                  <div className="mt-auto pt-8">
                    <div className="border-t border-[#eef0f3] pt-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleTourCityReminder({ success: '已标记想看', cancel: '已取消想看' })}
                          disabled={actionLoading === 'TOUR_CITY_REMINDER'}
                          className={`inline-flex h-10 min-w-[94px] items-center justify-center gap-2 rounded-xl border px-5 text-[14px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                            cityReminderActive
                              ? 'border-[#FF1475] bg-[#FF1475] text-white hover:bg-[#E00D65]'
                              : 'border-[#FF1475] bg-white text-[#FF1475] hover:bg-[#FFF0F5]'
                          }`}
                        >
                          <Heart className={`h-4 w-4 ${cityReminderActive ? 'fill-current' : ''}`} />
                          {cityReminderActive ? '已想看' : '想看'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleArtistFollow()}
                          disabled={actionLoading === 'ARTIST_FOLLOW'}
                          className={`inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl border px-5 text-[14px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                            artistFollowActive
                              ? 'border-[#FFD6E4] bg-[#FFF0F5] text-[#E6005C]'
                              : 'border-[#e5e7eb] bg-white text-[#111827] hover:border-[#FFD6E4] hover:bg-[#FFF0F5] hover:text-[#E6005C]'
                          }`}
                        >
                          {artistFollowActive ? <UserCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                          {artistFollowActive ? '已关注' : '关注艺人'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#eef0f3] py-7">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-[#111]">
                    <MapPin className="h-4 w-4 text-[#FF1475]" />
                    选择巡演城市
                  </div>
                  <div className="text-[12px] text-[#9CA3AF]">点击下方各站体验不同发布状态</div>
                </div>
                <div className="overflow-x-auto overflow-y-visible scrollbar-hide py-2" aria-label="巡演城市站点">
                  <div className="flex min-w-max gap-3">
                    {stationDetails.map(item => {
                      const active = selectedStation?.station.id === item.station.id
                      const meta = getStationStatusMeta(item)
                      return (
                        <button
                          key={item.station.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedStation(item)}
                          className={`relative min-h-[70px] w-[162px] rounded-xl border px-4 pb-3 pt-5 text-left transition-all duration-200 ${
                            active
                              ? 'border-[#FF1475] bg-[#FFF0F5] text-[#E6005C]'
                              : 'border-[#e5e7eb] bg-white text-[#111827] hover:border-[#FFD6E4] hover:bg-[#fffafd]'
                          }`}
                        >
                          <span className={`absolute right-0 top-0 rounded-bl-lg rounded-tr-xl px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
                            {meta.text}
                          </span>
                          <div className="text-[15px] font-semibold">{getStationTitle(item)}</div>
                          <div className="mt-2 text-[12px] text-[#667085]">{formatStationDate(item)}</div>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setShowEncoreCityModal(true)}
                      className="flex min-h-[70px] w-[144px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#FFD6E4] bg-white px-4 py-3 text-[#E6005C] transition-all duration-200 hover:bg-[#FFF0F5]"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-[14px] font-semibold">+ 求加场</span>
                    </button>
                  </div>
                </div>
              </div>

              {selectedStation && selectedState === 'ACTIVE' ? (
                <div className="mt-7 rounded-2xl border border-[#D6F5E2] bg-[#F8FFFB] p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[20px] font-semibold text-[#111]">{selectedCityLabel} · 正在售票</h2>
                        <span className="rounded-full bg-[#E8F8EE] px-3 py-1 text-[12px] font-semibold text-[#28C76F]">售票中</span>
                      </div>
                      <div className="mt-3 grid gap-3 text-[13px] text-[#667085] sm:grid-cols-3">
                        <span>时间：{selectedSessionTime}</span>
                        <span>场馆：{selectedStation.venueName || '场馆待公布'}</span>
                        <span>票价：{formatPrice(selectedStation.priceMin, selectedStation.priceMax)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStation.activity) router.push(`/activity/${selectedStation.activity.id}`)
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF1475] px-7 text-[14px] font-semibold text-white transition-colors hover:bg-[#E00D65]"
                    >
                      立即购票
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-7 flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7eb] bg-[#FAFBFD] px-6 py-10 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#eef0f3] bg-white text-[#FF1475]">
                    <Clock3 className="h-7 w-7" />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h2 className="text-[20px] font-semibold text-[#111]">{selectedCityLabel} · 演出筹备中</h2>
                    <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[12px] font-medium text-[#6B7280]">时间待公布</span>
                  </div>
                  <p className="mt-3 max-w-[520px] text-[13px] leading-6 text-[#8a93a3]">
                    本站演出场馆、具体时间及票档区间正由主办方积极筹备中。开启开售提醒，第一时间接收最新开票排期通知。
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleTourCityReminder({
                        success: '已成功订阅，开票前将短信提醒！',
                        cancel: '已关闭开售提醒',
                      })}
                      disabled={actionLoading === 'TOUR_CITY_REMINDER'}
                      className={`inline-flex h-11 min-w-[156px] items-center justify-center gap-2 rounded-full px-6 text-[14px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                        cityReminderActive ? 'bg-[#28C76F] hover:bg-[#22B463]' : 'bg-[#FF1475] hover:bg-[#E00D65]'
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                      {cityReminderActive ? '已开启开售提醒' : '开启开售提醒'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTourCityReminder({
                        success: '已登记观看意向',
                        keepWhenActive: true,
                      })}
                      disabled={actionLoading === 'TOUR_CITY_REMINDER'}
                      className="inline-flex h-11 min-w-[142px] items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-6 text-[14px] font-semibold text-[#374151] transition-colors hover:border-[#FFD6E4] hover:bg-[#FFF0F5] hover:text-[#E6005C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      登记观看意向
                    </button>
                  </div>
                  <div className="mt-5 flex items-center gap-1 text-[12px] text-[#8a93a3]">
                    <ShieldCheck className="h-4 w-4 text-[#28C76F]" />
                    官方正品保障 · 开票前短信与站内信双重通知
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      <Footer />

      {showEncoreCityModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={closeEncoreCityModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="encore-city-title"
            className="relative flex max-h-[80vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eef0f3] px-6 py-5">
              <div>
                <h2 id="encore-city-title" className="text-[20px] font-semibold text-[#111]">我想看的城市</h2>
                <p className="mt-1 text-[13px] text-[#8a93a3]">选择希望加场的城市，主办方会收到你的期待。</p>
              </div>
              <button
                type="button"
                aria-label="关闭我想看的城市弹窗"
                onClick={closeEncoreCityModal}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#667085] transition-colors hover:bg-[#F4F5F7] hover:text-[#111]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-6">
                <div className="mb-3 text-[13px] font-semibold text-[#111]">当前定位城市</div>
                <button
                  type="button"
                  onClick={() => void submitEncoreCityWish(currentLocationCity)}
                  disabled={Boolean(encoreSubmittingCity)}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[#FFF0F5] px-5 text-[14px] font-semibold text-[#E6005C] transition-colors hover:bg-[#FFE3EE] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {currentLocationCity}
                </button>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-[#111]">热门城市</div>
                  <div className="relative w-[220px] max-w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      value={citySearch}
                      onChange={event => setCitySearch(event.target.value)}
                      placeholder="搜索城市"
                      className="h-9 w-full rounded-full border border-[#eef0f3] bg-[#FAFBFD] pl-9 pr-3 text-[13px] outline-none transition focus:border-[#FFD6E4] focus:bg-white focus:ring-4 focus:ring-[#FF1475]/10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {HOT_CITIES.map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => void submitEncoreCityWish(city)}
                      disabled={Boolean(encoreSubmittingCity)}
                      className="h-10 rounded-xl bg-[#F7F8FA] text-[14px] font-medium text-[#344054] transition-all hover:bg-[#FFF0F5] hover:text-[#E6005C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative pr-8">
                <div className="mb-3 text-[13px] font-semibold text-[#111]">{citySearch ? '搜索结果' : '按字母排序'}</div>
                <div className="space-y-5">
                  {cityGroups.map(group => (
                    <section key={group.letter} id={`tour-city-group-${group.letter}`} className="scroll-mt-4">
                      <div className="mb-2 text-[13px] font-semibold text-[#E6005C]">{group.letter}</div>
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 sm:grid-cols-5">
                        {group.cities.map(city => (
                          <button
                            key={`${group.letter}-${city}`}
                            type="button"
                            onClick={() => void submitEncoreCityWish(city)}
                            disabled={Boolean(encoreSubmittingCity)}
                            className="rounded-lg px-2 py-1.5 text-center text-[13px] text-[#475467] transition-colors hover:bg-[#FFF0F5] hover:text-[#E6005C] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {encoreSubmittingCity === city ? '提交中...' : city}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  {cityGroups.length === 0 && (
                    <div className="rounded-xl bg-[#FAFBFD] py-10 text-center text-[13px] text-[#9CA3AF]">未能找到匹配的城市</div>
                  )}
                </div>
                <div className="absolute right-0 top-8 hidden flex-col gap-0.5 rounded-full bg-[#FAFBFD] px-1 py-2 text-center sm:flex">
                  {cityGroups.map(group => (
                    <a
                      key={group.letter}
                      href={`#tour-city-group-${group.letter}`}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-[#9CA3AF] transition-colors hover:bg-[#FFF0F5] hover:text-[#E6005C]"
                    >
                      {group.letter}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {centerToast && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div key={centerToast.id} className="flex min-w-[180px] animate-[tour-center-toast_1.5s_ease-in-out_forwards] flex-col items-center rounded-2xl bg-black/80 px-6 py-4 text-white shadow-2xl">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Check className="h-5 w-5" />
            </div>
            <div className="text-[14px] font-medium">{centerToast.message}</div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes tour-center-toast {
          0% { opacity: 0; transform: scale(0.92); }
          12% { opacity: 1; transform: scale(1); }
          82% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.96); }
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}
