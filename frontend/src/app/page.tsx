'use client'

import { useState, useEffect, useCallback } from 'react'
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const navCategories = categories.map((c) => ({ id: String(c.id), name: c.name }))

  return (
    <>
      <Header />
      <CategoryNav categories={navCategories} />
      <Banner slides={banners} />
      <main>
        {loading ? (
          <section className="py-10">
            <div className="max-w-[1200px] mx-auto px-5">
              <div className="text-center text-[#999] py-20 text-sm">加载中...</div>
            </div>
          </section>
        ) : sections.length === 0 ? (
          <section className="py-10">
            <div className="max-w-[1200px] mx-auto px-5">
              <div className="text-center text-[#999] py-20 text-sm">暂无活动</div>
            </div>
          </section>
        ) : (
          sections.map((section) => (
            <SectionRow key={section.id} section={section} />
          ))
        )}
      </main>
      <Footer />
    </>
  )
}
