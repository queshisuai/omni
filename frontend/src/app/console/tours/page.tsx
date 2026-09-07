'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { announceTourCities, deleteTourDraft, getAdminTourDetail, listAdminArtists, listAdminTours, listCategories } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { hasConsolePermission } from '@/lib/console-auth'
import type { ArtistEntity, CategoryVO, StationEntity, TourAdminDetailVO, TourEntity, UserRole } from '@/types/api'

const ADMIN_FETCH_SIZE = 500

type TourDraftRow = {
  tour: TourEntity
  stations: StationEntity[]
  cityNames: string[]
  configuredCount: number
  categoryName: string
  artistName: string
}

export default function ToursPage() {
  const [rows, setRows] = useState<TourDraftRow[]>([])
  const [role, setRole] = useState<UserRole | ''>('')
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [announcingId, setAnnouncingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const loadDraftsRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const canManageTours = hasConsolePermission(role, permissionCodes, 'tour.manage')
  const pageRows = useMemo(() => rows.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [rows, page])

  const loadDrafts = useCallback(() => {
    const user = getUser()
    if (!user) {
      setCheckingRole(false)
      setLoading(false)
      setError('请先登录后再查看巡演草稿')
      return
    }
    const permissions = user.permissionCodes || []
    setRole(user.role || 'user')
    setPermissionCodes(permissions)
    setCheckingRole(false)

    if (!hasConsolePermission(user.role, permissions, 'tour.manage')) {
      setLoading(false)
      setError('无权限访问')
      return
    }

    setLoading(true)
    setError('')
    Promise.all([
      listAdminTours(user.userId, { page: 1, size: ADMIN_FETCH_SIZE }),
      listCategories().catch(() => [] as CategoryVO[]),
      listAdminArtists({ page: 1, size: ADMIN_FETCH_SIZE }).catch(() => ({ records: [] as ArtistEntity[], total: 0, current: 1, size: ADMIN_FETCH_SIZE, pages: 1 })),
    ])
      .then(async ([tourRes, categories, artistRes]) => {
        const categoryNameById = new Map(categories.map(category => [category.id, category.name]))
        const artistNameById = new Map(artistRes.records.map(artist => [artist.id, artist.name]))
        const drafts = tourRes.records.filter(tour => tour.reviewStatus === 'draft')
        const details = await Promise.all(drafts.map(tour => getAdminTourDetail(user.userId, tour.id).catch(() => null)))
        const nextRows = drafts.map((tour, index) => {
          const detail = details[index]
          const stations = detail?.stations ?? []
          return {
            tour,
            stations,
            cityNames: buildCityNames(stations),
            configuredCount: countConfiguredStations(detail, stations),
            categoryName: tour.categoryId ? categoryNameById.get(tour.categoryId) || '类目待同步' : '未设置类目',
            artistName: tour.artistId ? artistNameById.get(tour.artistId) || '艺人信息待同步' : '未设置主艺人',
          }
        })
        setRows(nextRows.sort((a, b) => (b.tour.createTime || '').localeCompare(a.tour.createTime || '') || b.tour.id - a.tour.id))
        setPage(1)
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载巡演草稿失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadDraftsRef.current = loadDrafts
  }, [loadDrafts])

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadDraftsRef.current()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadDraftsRef.current(), 0)
    return () => window.clearTimeout(timer)
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

  const handleAnnounce = async (row: TourDraftRow) => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再操作')
      return
    }
    if (!(await globalConfirm(`确认官宣巡演草稿“${row.tour.title}”的规划城市？官宣城市只公开城市规划，不代表直接开票售票。`))) return
    setAnnouncingId(row.tour.id)
    try {
      await announceTourCities(user.userId, row.tour.id)
      await globalAlert('巡演规划城市已官宣')
      loadDrafts()
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '官宣城市失败')
    } finally {
      setAnnouncingId(null)
    }
  }

  const handleDelete = async (row: TourDraftRow) => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再操作')
      return
    }
    if (!(await globalConfirm(`确认删除巡演草稿“${row.tour.title}”？删除后不可恢复。`))) return
    setDeletingId(row.tour.id)
    try {
      await deleteTourDraft(user.userId, row.tour.id)
      await globalAlert('巡演草稿已删除')
      loadDrafts()
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '删除巡演草稿失败')
    } finally {
      setDeletingId(null)
    }
  }

  if (checkingRole) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!role) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">登录后可查看和管理巡演草稿。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">巡演草稿管理</h1>
          <p className="mt-1 text-[13px] text-[#999]">先官宣规划城市，再逐站补齐场馆、时间、座位图和票档。</p>
        </div>
        {canManageTours && (
          <Link href="/console/activities/new?type=tour" className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#e0105a]">
            + 新建巡演草稿
          </Link>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无巡演草稿。</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full min-w-[980px] text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa] text-left text-[#666]">
                <th className="whitespace-nowrap p-3">巡演名称</th>
                <th className="w-24 min-w-[90px] whitespace-nowrap p-3">所属类目</th>
                <th className="whitespace-nowrap p-3">主艺人/团体</th>
                <th className="whitespace-nowrap p-3">规划城市</th>
                <th className="w-28 min-w-[110px] whitespace-nowrap p-3">站点配置进度</th>
                <th className="whitespace-nowrap p-3">创建时间</th>
                <th className="min-w-[220px] whitespace-nowrap p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => (
                <tr key={row.tour.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="max-w-[240px] truncate p-3 font-medium text-[#1a1a2e]" title={row.tour.title}>
                    <Link href={`/console/tours/${row.tour.id}`} className="hover:text-[#ff1268]">{row.tour.title}</Link>
                  </td>
                  <td className="w-24 min-w-[90px] whitespace-nowrap p-3 text-[#666]">{row.categoryName}</td>
                  <td className="max-w-[180px] truncate p-3 text-[#666]" title={row.artistName}>{row.artistName}</td>
                  <td className="p-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1.5">
                      {row.cityNames.length > 0 ? row.cityNames.map(city => (
                        <span key={city} className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[12px] text-[#2563eb]">{city}</span>
                      )) : <span className="text-[#999]">城市待补齐</span>}
                    </div>
                  </td>
                  <td className="w-28 min-w-[110px] whitespace-nowrap p-3 text-[#666]">
                    {row.configuredCount}/{row.stations.length} 站已配置
                  </td>
                  <td className="whitespace-nowrap p-3 text-[#999]">{row.tour.createTime?.substring(0, 10) || '-'}</td>
                  <td className="min-w-[220px] whitespace-nowrap p-3 text-center">
                    <div className="flex items-center gap-2 whitespace-nowrap justify-center">
                      <Link href={`/console/tours/${row.tour.id}`} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">配置站点</Link>
                      <button
                        type="button"
                        onClick={() => handleAnnounce(row)}
                        disabled={announcingId === row.tour.id}
                        className="rounded-lg border border-[#16a34a] px-3 py-1.5 text-[13px] text-[#16a34a] hover:bg-[#f0fff4] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {announcingId === row.tour.id ? '官宣中' : '官宣城市'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.tour.id}
                        className="rounded-lg border border-[#fecaca] px-3 py-1.5 text-[13px] text-[#ef4444] hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === row.tour.id ? '删除中' : '删除草稿'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[#f0f0f0] px-4 pb-4">
            <GlobalPagination page={page} total={rows.length} loading={loading} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}

function buildCityNames(stations: StationEntity[]) {
  return Array.from(new Set(stations.map(station => station.city?.trim()).filter((city): city is string => Boolean(city))))
}

function countConfiguredStations(detail: TourAdminDetailVO | null, stations: StationEntity[]) {
  const details = detail?.stationDetails ?? []
  return stations.filter((station, index) => {
    const stationDetail = details.find(item => item.station.id === station.id) ?? details[index]
    return Boolean(
      stationDetail?.venueName
      || (stationDetail?.sessions?.length ?? 0) > 0
      || (station.publishStatus && station.publishStatus !== 'draft' && station.publishStatus !== 'city_announced'),
    )
  }).length
}
