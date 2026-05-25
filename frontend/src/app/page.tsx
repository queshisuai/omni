'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from '@/components/Header'
import { CategoryNav } from '@/components/CategoryNav'
import { Banner } from '@/components/Banner'
import { SectionRow } from '@/components/SectionRow'
import { Footer } from '@/components/Footer'
import { listActivities, listCategories } from '@/lib/api'
import { categories as mockCategories, sections as mockSections, banners } from '@/lib/mock-data'
import type { CategoryVO, ActivityVO } from '@/types/api'
import type { SectionData, Activity } from '@/types/damai'

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

function groupByCategory(activities: Activity[]): SectionData[] {
  const map = new Map<string, Activity[]>()
  for (const a of activities) {
    const list = map.get(a.categoryId) || []
    list.push(a)
    map.set(a.categoryId, list)
  }
  return Array.from(map.entries()).map(([name, items]) => ({
    id: name,
    title: name,
    category: name,
    viewAllUrl: `/search?category=${encodeURIComponent(name)}`,
    items,
  }))
}

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryVO[]>([])
  const [sections, setSections] = useState<SectionData[]>([])
  const [loading, setLoading] = useState(true)
  const fetchDataRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catData, actData] = await Promise.all([
        listCategories(),
        listActivities({ page: 1, size: 50 }),
      ])
      setCategories(catData)
      setSections(groupByCategory(actData.records.map(toActivity)))
    } catch {
      // 降级到 mock 数据
      setCategories(mockCategories.map((c, i) => ({ id: i + 1, name: c.name, icon: null, sort: 0, status: 1 })) as CategoryVO[])
      setSections(mockSections)
    } finally {
      setLoading(false)
    }
  }, [])

  fetchDataRef.current = fetchData

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    fetchDataRef.current()
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const navCategories = categories.map((c) => ({ id: String(c.id), name: c.name }))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      {/* Hero Section with Banner and Nav */}
      <div className="relative bg-white pb-6 rounded-b-[40px] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] z-10">
        <CategoryNav categories={navCategories} />
        <Banner slides={banners} />
      </div>

      <main className="flex-1 pb-20 -mt-6 pt-10">
        {loading ? (
          <section className="py-20">
            <div className="max-w-[1200px] mx-auto px-5">
              <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
                <div className="w-8 h-8 border-4 border-[#ff1268]/20 border-t-[#ff1268] rounded-full animate-spin" />
                <div className="text-sm font-medium tracking-wider">正在加载精彩演出...</div>
              </div>
            </div>
          </section>
        ) : sections.length === 0 ? (
          <section className="py-20">
            <div className="max-w-[1200px] mx-auto px-5">
              <div className="text-center text-gray-400 py-20 text-sm font-medium tracking-wider">暂无演出活动</div>
            </div>
          </section>
        ) : (
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionRow key={section.id} section={section} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
