'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { listAdminTours } from '@/lib/api'
import type { PageResult, TourEntity, UserRole } from '@/types/api'

export default function ToursPage() {
  const [data, setData] = useState<PageResult<TourEntity> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const loadToursRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const isAdmin = role === 'admin'

  const loadTours = () => {
    const user = getUser()
    if (!user) return
    setRole(user.role || 'user')
    setCheckingRole(false)
    setLoading(true)
    setError('')
    listAdminTours(user.userId).then(setData).catch(err => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false))
  }

  loadToursRef.current = loadTours

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadToursRef.current()
  }

  useEffect(() => {
    loadTours()
  }, [])

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

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '平台演出项目' : '我的演出项目'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{isAdmin ? '查看平台 Tour 草稿与站点状态。' : '创建和查看自己主办的 Tour 草稿与站点状态。'}</p>
        </div>
        {!isAdmin && <Link href="/console/tours/new" className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">创建我的演出</Link>}
      </div>
      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
      ) : !data || data.records.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">{isAdmin ? '暂无平台演出项目。' : '暂无演出，先创建一个 Tour 草稿。'}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa] text-left text-[#666]">
                <th className="p-3">ID</th>
                <th className="p-3">演出名称</th>
                <th className="p-3">审核状态</th>
                <th className="p-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map(tour => (
                <tr key={tour.id} className="border-b border-[#f0f0f0]">
                  <td className="p-3 text-[#999]">{tour.id}</td>
                  <td className="p-3 font-medium text-[#333]">{tour.title}</td>
                  <td className="p-3 text-[#666]">{tour.reviewStatus}</td>
                  <td className="p-3 text-[#999]">{tour.createTime?.substring(0, 10) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
