'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header, HOT_CITIES, OTHER_CITIES } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { TicketCard } from '@/components/TicketCard'
import { listActivities, listCategories } from '@/lib/api'
import { categories as mockCategories, sections as mockSections } from '@/lib/mock-data'
import type { CategoryVO, ActivityVO } from '@/types/api'
import type { Activity } from '@/types/damai'

type SortType = 'recommend' | 'relevance' | 'recent' | 'newest'
type TimeFilter = 'all' | 'today' | 'tomorrow' | 'weekend' | 'month' | 'custom'

const SORT_LABELS: Record<SortType, string> = {
  recommend: '推荐排序',
  relevance: '相关度排序',
  recent: '最近开场',
  newest: '最新上架',
}

const TIME_LABELS: Record<Exclude<TimeFilter, 'custom'>, string> = {
  all: '全部',
  today: '今天',
  tomorrow: '明天',
  weekend: '本周末',
  month: '一个月内',
}

function toActivity(vo: ActivityVO): Activity {
  return {
    id: String(vo.id),
    title: vo.name,
    categoryId: vo.categoryName,
    poster: vo.poster || '/background.png',
    venue: vo.venueCity || '待定',
    showTime: vo.startTime ? vo.startTime.slice(0, 10) : '待定',
    priceRange: vo.minPrice ? `¥${vo.minPrice}起` : '待定',
    price: vo.minPrice || 0,
    status: vo.status === 1 ? 'on_sale' : vo.status === 2 ? 'coming_soon' : 'sold_out',
  }
}

// ========== 筛选栏组件 ==========
function FactorTitle({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      width: 80, textAlign: 'right', fontSize: 14, color: '#968788',
      lineHeight: '26px', flexShrink: 0, paddingRight: 20,
    }}>
      {children}
    </span>
  )
}

function FilterItem({ active, onClick, children, style }: {
  active: boolean; onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-block',
        padding: '0 8px',
        height: 26,
        lineHeight: '26px',
        fontSize: 14,
        marginRight: 6,
        cursor: 'pointer',
        backgroundColor: active ? '#ED0B75' : 'transparent',
        color: active ? '#fff' : '#333',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

// ========== 分页组件 ==========
function Pagination({ page, totalPages, onPageChange }: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 24, marginBottom: 16 }}>
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        style={{
          padding: '6px 12px', fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer',
          border: '1px solid #e5e5e5', backgroundColor: '#fff', color: page <= 1 ? '#ccc' : '#333',
          borderRadius: 2, outline: 'none',
        }}
      >
        上一页
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#999', fontSize: 13 }}>...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              minWidth: 32, height: 32, fontSize: 13, cursor: 'pointer',
              border: '1px solid #e5e5e5', borderRadius: 2, outline: 'none',
              backgroundColor: p === page ? '#ED0B75' : '#fff',
              color: p === page ? '#fff' : '#333',
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        style={{
          padding: '6px 12px', fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer',
          border: '1px solid #e5e5e5', backgroundColor: '#fff', color: page >= totalPages ? '#ccc' : '#333',
          borderRadius: 2, outline: 'none',
        }}
      >
        下一页
      </button>
      <span style={{ marginLeft: 8, fontSize: 13, color: '#666' }}>
        共{totalPages}页
      </span>
    </div>
  )
}

// ========== 排序栏组件 ==========
function SortBar({ sort, onSortChange, page, totalPages }: {
  sort: SortType
  onSortChange: (s: SortType) => void
  page: number
  totalPages: number
}) {
  return (
    <div style={{
      width: 928, height: 40, backgroundColor: '#f5f5f5',
      border: '1px solid #eaeaea', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {(Object.entries(SORT_LABELS) as [SortType, string][]).map(([key, label]) => (
          <span
            key={key}
            onClick={() => onSortChange(key)}
            style={{
              display: 'flex', alignItems: 'center', height: '100%',
              padding: '0 24px', fontSize: 14, cursor: 'pointer',
              color: sort === key ? '#ED0B75' : '#666',
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 16 }}>
        <span style={{ fontSize: 14, color: '#666' }}>
          {page}/{totalPages || 1}
        </span>
      </div>
    </div>
  )
}

// ========== 主内容 ==========
function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('category') || ''
  const initialKeyword = searchParams.get('keyword') || ''

  const [categories, setCategories] = useState<CategoryVO[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [activeTime, setActiveTime] = useState<TimeFilter>('all')
  const [sort, setSort] = useState<SortType>('recommend')
  const usingMock = useRef(false)
  const mockAllActivities = useRef<Activity[]>([])
  const dateInputRef = useRef<HTMLInputElement>(null)

  const fetchActivities = async (cat: string, p: number) => {
    setLoading(true)
    try {
      let currentCats = categories
      if (currentCats.length === 0) {
        // 如果没有指定分类，可以并行请求分类和活动以提升首屏速度
        if (!cat) {
          const [catData, actData] = await Promise.all([
            listCategories(),
            listActivities({ page: p, size: 20 })
          ])
          setCategories(catData)
          setActivities(actData.records.map(toActivity))
          setTotal(actData.total)
          setTotalPages(actData.pages)
          usingMock.current = false
          setLoading(false)
          return
        } else {
          currentCats = await listCategories()
          setCategories(currentCats)
        }
      }

      let categoryId: number | undefined
      if (cat) {
        const found = currentCats.find((c) => c.name === cat)
        if (found) categoryId = found.id
      }

      const data = await listActivities({ page: p, size: 20, categoryId })
      setActivities(data.records.map(toActivity))
      setTotal(data.total)
      setTotalPages(data.pages)
      usingMock.current = false
    } catch {
      // 降级到 mock 数据 —— 只在首次加载时拉取全量
      const mapped = mockCategories.map((c, i) => ({ id: i + 1, name: c.name, icon: null, sort: 0, status: 1 }))
      setCategories(mapped as CategoryVO[])

      if (mockAllActivities.current.length === 0) {
        let all: Activity[] = []
        if (cat) {
          const section = mockSections.find((s) => s.title === cat)
          if (section) all = section.items
        } else {
          all = mockSections.flatMap((s) => s.items)
        }
        mockAllActivities.current = all
      }

      const all = mockAllActivities.current
      setActivities(all)
      setTotal(all.length)
      setTotalPages(Math.ceil(all.length / 20) || 1)
      usingMock.current = true
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities(activeCategory, page)
  }, [activeCategory, page])

  const [activeCity, setActiveCity] = useState('全部')
  const [showAllCities, setShowAllCities] = useState(false)
  const [citySearchKeyword, setCitySearchKeyword] = useState('')
  const [customDate, setCustomDate] = useState('')

  // 时间过滤辅助函数
  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const matchTime = (showTime: string): boolean => {
    if (activeTime === 'all') return true
    const now = new Date()
    const todayStr = toLocalDateStr(now)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = toLocalDateStr(tomorrow)
    // 提取 showTime 中的日期部分 (支持 "2026.05.16" / "2026-05-16" / "2026.05.16-05.17" 等格式)
    const dateMatch = showTime.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/)
    const actDateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : ''
    if (!actDateStr) return true // 无法解析日期时不过滤

    // 对于跨天活动 (如 "2026.05.16-05.17")，同时提取结束日期
    const endMatch = showTime.match(/(\d{4})[.\-](\d{2})[.\-](\d{2}).*?(\d{2})[.\-](\d{2})$/)
    const actEndStr = endMatch ? `${endMatch[1]}-${endMatch[4]}-${endMatch[5]}` : actDateStr

    if (activeTime === 'today') return actDateStr <= todayStr && actEndStr >= todayStr
    if (activeTime === 'tomorrow') return actDateStr <= tomorrowStr && actEndStr >= tomorrowStr
    if (activeTime === 'weekend') {
      const day = now.getDay()
      const satOffset = day === 0 ? -1 : 6 - day
      const sat = new Date(now); sat.setDate(sat.getDate() + satOffset)
      const sun = new Date(sat); sun.setDate(sun.getDate() + 1)
      const satStr = toLocalDateStr(sat)
      const sunStr = toLocalDateStr(sun)
      return actEndStr >= satStr && actDateStr <= sunStr
    }
    if (activeTime === 'month') {
      const monthLater = new Date(now); monthLater.setMonth(monthLater.getMonth() + 1)
      return actEndStr >= todayStr && actDateStr <= toLocalDateStr(monthLater)
    }
    if (activeTime === 'custom' && customDate) return actDateStr <= customDate && actEndStr >= customDate
    return true
  }

  // 当前页数据：mock 模式客户端切片，API 模式服务端已分页
  const pageSize = 20
  const keyword = searchParams.get('keyword') || ''
  const allFiltered = activities.filter((a) => {
    const matchKeyword = keyword ? a.title.toLowerCase().includes(keyword.toLowerCase()) : true
    const matchCity = activeCity === '全部' || a.venue.includes(activeCity) || a.title.includes(activeCity)
    const matchTimeFilter = matchTime(a.showTime)
    return matchKeyword && matchCity && matchTimeFilter
  })
  
  const isFiltering = keyword || activeCity !== '全部' || activeTime !== 'all'
  const displayTotal = usingMock.current ? allFiltered.length : (isFiltering ? allFiltered.length : total)
  const pageData = usingMock.current
    ? allFiltered.slice((page - 1) * pageSize, page * pageSize)
    : allFiltered
  const displayTotalPages = usingMock.current
    ? Math.ceil(allFiltered.length / pageSize) || 1
    : (isFiltering ? Math.ceil(allFiltered.length / pageSize) || 1 : totalPages)

  const handlePageChange = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryChange = (catName: string) => {
    const newCat = activeCategory === catName ? '' : catName
    mockAllActivities.current = []
    setActiveCategory(newCat)
    setPage(1)
    const params = new URLSearchParams()
    if (newCat) params.set('category', newCat)
    if (initialKeyword) params.set('keyword', initialKeyword)
    router.replace(`/search${params.toString() ? `?${params.toString()}` : ''}`)
  }

  // 客户端关键字过滤（已在上方计算 pageData 时使用，此处保留变量兼容旧代码）
  const filteredActivities = pageData

  const handleTimeChange = (time: TimeFilter) => {
    setActiveTime(time)
    if (time !== 'custom') setCustomDate('')
    setPage(1)
  }

  return (
    <div style={{ width: 1200, margin: '0 auto', padding: '20px 0' }}>
      {/* 结果计数 */}
      <div style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>
        {keyword ? (
          <>搜索&quot;<span style={{ color: '#ED0B75' }}>{keyword}</span>&quot; 共<span style={{ color: '#ED0B75', margin: '0 4px' }}>{displayTotal}</span>个商品</>
        ) : (
          <>共<span style={{ color: '#ED0B75', margin: '0 4px' }}>{displayTotal}</span>个商品</>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* 左侧主体 */}
        <div style={{ width: 928 }}>
          {/* 筛选面板 */}
          <div style={{
            border: '1px solid #e9e9e9', padding: '0 24px',
            marginBottom: 12, backgroundColor: '#fff',
          }}>
            {/* 城市筛选 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px dotted #e9e9e9' }}>
              <FactorTitle>城 市：</FactorTitle>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 14, color: '#333' }}>
                    当前选中城市
                    <span style={{ color: '#ED0B75', marginLeft: 8 }}>{activeCity === '全部' ? '全国' : activeCity}</span>
                  </div>
                  <input 
                    type="text"
                    placeholder="输入城市名快速搜索"
                    value={citySearchKeyword}
                    onChange={(e) => setCitySearchKeyword(e.target.value)}
                    style={{
                      padding: '4px 12px', fontSize: 12, border: '1px solid #e5e5e5',
                      borderRadius: 12, outline: 'none', width: 140, color: '#333'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 0', maxHeight: (showAllCities || citySearchKeyword) ? 300 : 'auto', overflowY: (showAllCities || citySearchKeyword) ? 'auto' : 'visible' }} className="custom-scrollbar">
                  <FilterItem 
                    active={activeCity === '全部'}
                    onClick={() => { setActiveCity('全部'); setPage(1); }}
                  >
                    全部
                  </FilterItem>
                  {((showAllCities || citySearchKeyword) ? [...HOT_CITIES, ...OTHER_CITIES] : HOT_CITIES)
                    .filter(city => !citySearchKeyword || city.includes(citySearchKeyword))
                    .map((city, index) => (
                    <FilterItem 
                      key={`${city}-${index}`} 
                      active={activeCity === city}
                      onClick={() => { setActiveCity(city); setPage(1); }}
                    >
                      {city}
                    </FilterItem>
                  ))}
                  <button
                    onClick={() => setShowAllCities(!showAllCities)}
                    style={{
                      background: 'none', border: 'none', color: '#ED0B75',
                      fontSize: 14, cursor: 'pointer', padding: '0 8px',
                      height: 26, lineHeight: '26px'
                    }}
                  >
                    {showAllCities ? '收起 ^' : '更多...'}
                  </button>
                </div>
              </div>
            </div>

            {/* 分类筛选 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px dotted #e9e9e9' }}>
              <FactorTitle>分 类：</FactorTitle>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                <FilterItem
                  active={!activeCategory}
                  onClick={() => handleCategoryChange('')}
                  style={{ marginRight: 24 }}
                >
                  全部
                </FilterItem>
                {categories.map((cat) => (
                  <FilterItem
                    key={cat.id}
                    active={activeCategory === cat.name}
                    onClick={() => handleCategoryChange(cat.name)}
                    style={{ marginRight: 24 }}
                  >
                    {cat.name}
                  </FilterItem>
                ))}
              </div>
            </div>

            {/* 时间筛选 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0' }}>
              <FactorTitle>时 间：</FactorTitle>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                {(Object.entries(TIME_LABELS) as [TimeFilter, string][]).map(([key, label]) => (
                  <FilterItem
                    key={key}
                    active={activeTime === key}
                    onClick={() => handleTimeChange(key)}
                    style={{ marginRight: 24 }}
                  >
                    {label}
                  </FilterItem>
                ))}
                <div style={{ position: 'relative', display: 'inline-block', marginLeft: 16 }}>
                  <span
                    onClick={() => dateInputRef.current?.showPicker()}
                    style={{
                      fontSize: 14, color: activeTime === 'custom' ? '#fff' : '#ED0B75',
                      backgroundColor: activeTime === 'custom' ? '#ED0B75' : 'transparent',
                      padding: '0 8px', height: 26, lineHeight: '26px',
                      cursor: 'pointer', display: 'inline-block',
                    }}
                  >
                    按日历{customDate ? ` (${customDate})` : ''}
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={customDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomDate(e.target.value);
                        setActiveTime('custom');
                        setPage(1);
                      } else {
                        setCustomDate('');
                        setActiveTime('all');
                        setPage(1);
                      }
                    }}
                    style={{
                      position: 'absolute', left: 0, bottom: 0,
                      width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 排序栏 */}
          <SortBar sort={sort} onSortChange={setSort} page={page} totalPages={displayTotalPages} />

          {/* 结果网格 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999', fontSize: 14 }}>
              努力加载中...
            </div>
          ) : pageData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999', fontSize: 14 }}>
              暂无符合条件的商品
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {pageData.map((activity) => (
                  <TicketCard key={activity.id} activity={activity} />
                ))}
              </div>
              <Pagination page={page} totalPages={displayTotalPages} onPageChange={handlePageChange} />
            </>
          )}
        </div>

        {/* 右侧推荐 */}
        <div style={{ width: 248 }}>
          <div style={{
            backgroundColor: '#fff', border: '1px solid #e9e9e9',
            padding: 16, marginBottom: 12,
          }}>
            <h3 style={{ fontSize: 16, color: '#333', margin: '0 0 12px', fontWeight: 500 }}>
              您可能还喜欢
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allFiltered.slice(0, 4).map((a) => (
                <a
                  key={a.id}
                  href={`/activity/${a.id}`}
                  style={{ display: 'flex', gap: 8, textDecoration: 'none' }}
                >
                  <img
                    src={a.poster}
                    alt={a.title}
                    style={{ width: 80, height: 106, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4, marginBottom: 4 }}
                      className="line-clamp-2">
                      {a.title}
                    </div>
                    <div style={{ fontSize: 16, color: '#ED0B75', fontWeight: 500 }}>
                      {a.priceRange}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== 页面入口 ==========
export default function SearchPage() {
  return (
    <>
      <Header />
      <Suspense fallback={
        <div style={{ width: 1200, margin: '0 auto', padding: '60px 0', textAlign: 'center', color: '#999', fontSize: 14 }}>
          加载中...
        </div>
      }>
        <SearchContent />
      </Suspense>
      <Footer />
    </>
  )
}
