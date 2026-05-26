'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { announceTourCities, deleteAdminActivity, deleteTourDraft, getActivityStation, listAdminActivities, listAdminTours, publishStation } from '@/lib/api'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import type { ActivityEntity, UserRole } from '@/types/api'

const ADMIN_FETCH_SIZE = 500

type DraftRow = {
  itemType: 'activity' | 'tour'
  id: number
  name: string
  organizerId?: number | null
  createTime?: string | null
}

function rowKey(row: DraftRow) {
  return `${row.itemType}-${row.id}`
}

function compareRows(a: DraftRow, b: DraftRow) {
  const byId = a.id - b.id
  if (byId !== 0) return byId
  return a.itemType.localeCompare(b.itemType)
}

function toActivityDraft(activity: ActivityEntity): DraftRow {
  return {
    itemType: 'activity',
    id: activity.id,
    name: activity.name,
    organizerId: activity.organizerId,
    createTime: activity.createTime,
  }
}

export default function ToursPage() {
  const [rows, setRows] = useState<DraftRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [publishingKey, setPublishingKey] = useState<string | null>(null)
  const loadDraftsRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const isAdmin = role === 'admin'

  const loadDrafts = useCallback(() => {
    const user = getUser()
    if (!user) {
      setCheckingRole(false)
      setLoading(false)
      setError('请先登录后再查看活动草稿')
      return
    }
    setRole(user.role || 'user')
    setCheckingRole(false)
    if (user.role !== 'admin' && user.role !== 'organizer') {
      setLoading(false)
      setError('无权限访问')
      return
    }
    setLoading(true)
    setError('')
    Promise.all([
      listAdminActivities(user.userId, { page: 1, size: ADMIN_FETCH_SIZE }),
      listAdminTours(user.userId, { page: 1, size: ADMIN_FETCH_SIZE }),
    ])
      .then(([activityRes, tourRes]) => {
        const activityDrafts = activityRes.records
          .filter(activity => activity.publishStatus === 'draft')
          .map(toActivityDraft)
        const tourDrafts: DraftRow[] = tourRes.records
          .filter(tour => tour.reviewStatus === 'draft')
          .map(tour => ({
            itemType: 'tour' as const,
            id: tour.id,
            name: tour.title,
            organizerId: tour.organizerId,
            createTime: tour.createTime,
          }))
        setRows([...activityDrafts, ...tourDrafts].sort(compareRows))
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
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

  const handleDelete = async (row: DraftRow) => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再操作')
      return
    }
    const label = row.itemType === 'tour' ? '巡演/多站点草稿' : '普通活动草稿'
    if (!(await globalConfirm(`确认删除${label}“${row.name}”？`))) return
    const key = rowKey(row)
    setDeletingKey(key)
    try {
      if (row.itemType === 'tour') {
        await deleteTourDraft(user.userId, row.id)
      } else {
        await deleteAdminActivity(row.id, { userId: user.userId, reason: '删除活动草稿' })
      }
      await globalAlert(`${label}已删除`)
      loadDrafts()
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : `删除${label}失败`)
    } finally {
      setDeletingKey(null)
    }
  }

  const handlePublish = async (row: DraftRow) => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再操作')
      return
    }
    const key = rowKey(row)
    if (row.itemType === 'tour') {
      if (!(await globalConfirm(`确认发布巡演/多站点草稿“${row.name}”并公开城市站点？场馆、时间和座位票档可继续按城市站点补齐。`))) return
      setPublishingKey(key)
      try {
        await announceTourCities(user.userId, row.id)
        await globalAlert('巡演活动和城市站点已发布')
        loadDrafts()
      } catch (err) {
        await globalAlert(err instanceof Error ? err.message : '发布巡演/多站点草稿失败')
      } finally {
        setPublishingKey(null)
      }
      return
    }

    if (!(await globalConfirm(`确认发布普通活动草稿“${row.name}”？发布前请确认站点场馆审批已通过，座位票档已配置。`))) return
    setPublishingKey(key)
    try {
      const detail = await getActivityStation(row.id)
      await publishStation(detail.station.id, {
        userId: user.userId,
        scheduleTba: true,
      })
      await globalAlert('普通活动草稿已发布')
      loadDrafts()
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '发布普通活动草稿失败')
    } finally {
      setPublishingKey(null)
    }
  }

  if (checkingRole) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!role) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">登录后可查看和管理活动草稿。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">活动发布/多站点草稿管理</h1>
          <p className="mt-1 text-[13px] text-[#999]">管理普通活动草稿和巡演/多站点草稿，补齐配置后发布活动。</p>
        </div>
        {!isAdmin && <Link href="/console/activities/new" className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">新建活动草稿</Link>}
      </div>
      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无活动草稿。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa] text-left text-[#666]">
                <th className="p-3">草稿类型</th>
                <th className="p-3">活动名称</th>
                <th className="p-3">草稿状态</th>
                <th className="p-3">创建时间</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const key = rowKey(row)
                const isTour = row.itemType === 'tour'
                const detailHref = isTour ? `/console/tours/${row.id}` : `/console/activities/${row.id}/edit`
                return (
                  <tr key={key} className="border-b border-[#f0f0f0]">
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] ${isTour ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#f5f5f5] text-[#666]'}`}>
                        {isTour ? '巡演 / 多站点活动' : '普通活动'}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-[#333]">
                      <Link href={detailHref} className="text-[#1a1a2e] hover:text-[#ff1268]">{row.name}</Link>
                    </td>
                    <td className="p-3 text-[#666]">草稿</td>
                    <td className="p-3 text-[#999]">{row.createTime?.substring(0, 10) || '-'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={detailHref} className="rounded px-2 py-1 text-[12px] text-[#3b82f6] hover:bg-[#eff6ff]">继续配置</Link>
                        <button disabled={publishingKey === key} onClick={() => handlePublish(row)} className="rounded px-2 py-1 text-[12px] text-[#16a34a] hover:bg-[#f0fff4] disabled:text-[#aaa]">
                          {publishingKey === key ? '发布中' : isTour ? '发布活动/城市' : '发布活动'}
                        </button>
                        <button disabled={deletingKey === key} onClick={() => handleDelete(row)} className="rounded px-2 py-1 text-[12px] text-[#ef4444] hover:bg-[#fff1f2] disabled:text-[#aaa]">
                          {deletingKey === key ? '删除中' : '删除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
