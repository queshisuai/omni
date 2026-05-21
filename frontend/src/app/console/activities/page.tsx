'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { listAdminActivities, deleteAdminActivity, updateActivityStatus, deactivateActivity } from '@/lib/api'
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, Search } from 'lucide-react'
import type { ActivityEntity, UserRole } from '@/types/api'

const PAGE_SIZE = 10

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityEntity[]>([])
  const [userId, setUserId] = useState(0)
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const loadDataRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const isAdmin = role === 'admin'

  const loadData = (nextPage = page) => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    setRole(u.role || 'user')
    setCheckingRole(false)
    setLoading(true)
    setError('')
    listAdminActivities(u.userId, {
      page: nextPage,
      size: PAGE_SIZE,
      keyword,
      status: status === '' ? undefined : Number(status),
    }).then(res => {
      setActivities(res.records)
      setTotal(res.total)
      setPages(res.pages || 1)
      setPage(res.current || nextPage)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载活动失败')
      setLoading(false)
    })
  }

  loadDataRef.current = loadData

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadDataRef.current()
  }

  useEffect(() => { loadData() }, [])

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

  const handleToggleStatus = async (activity: ActivityEntity) => {
    const newStatus = activity.status === 1 ? 0 : 1
    if (newStatus === 0) {
      const confirmed = confirm('下架并退款后，活动、场次、票档将全部下架，并直接为所有已支付订单发起真实支付宝退款。“同意退款”表示你确认平台将对这些已支付订单执行退款，可能产生退款失败、结果未知或需人工处理的记录。请确认：同意下架并同意退款。')
      if (!confirmed) return
      const result = await deactivateActivity(activity.id, {
        userId,
        confirmRefund: true,
        reason: isAdmin ? '平台下架活动自动退款' : '主办方下架活动自动退款',
      })
      const abnormalCount = result.refundFailedCount + result.refundUnknownCount + result.refundCompensationRequiredCount
      const summary = `已支付订单 ${result.paidOrderCount} 笔，退款成功 ${result.refundSuccessCount} 笔，退款失败 ${result.refundFailedCount} 笔，结果未知 ${result.refundUnknownCount} 笔，需人工处理 ${result.refundCompensationRequiredCount} 笔。`
      if (abnormalCount > 0) {
        alert(`活动已下架并发起退款，但部分退款失败/结果未知/需人工处理。${summary}`)
      } else {
        alert(`活动已下架并发起退款。${summary}`)
      }
    } else {
      await updateActivityStatus(activity.id, { userId, status: newStatus })
    }
    loadData(page)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该活动？')) return
    await deleteAdminActivity(id, userId)
    loadData(page)
  }

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadData(1)
  }

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '平台活动管理' : '我的活动管理'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{isAdmin ? '搜索、筛选和维护全平台活动上下架状态。' : '维护自己主办活动的编辑、删除、上架与下架并退款。'}</p>
        </div>
        <Link
          href="/console/activities/new"
          className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors"
        >
          <Plus className="w-4 h-4" /> {isAdmin ? '新建平台活动' : '新建我的活动'}
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mb-5 grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索活动名称"
            className="h-10 w-full rounded-lg border border-[#e5e5e5] pl-9 pr-3 text-[14px] outline-none focus:border-[#ff1268]"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
        >
          <option value="">全部状态</option>
          <option value="1">上架</option>
          <option value="0">下架</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#1a1a2e] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a42]"
        >
          查询
        </button>
      </form>

      {loading ? (
        <div className="text-center text-[#999] py-20 text-[14px]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">
          <div>{error}</div>
          <button
            onClick={() => loadData(page)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#ff1268] px-4 py-2 text-white"
          >
            <RefreshCw className="h-4 w-4" /> 重试
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无匹配活动，可调整筛选条件或点击右上角新建。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="text-left p-3 font-medium text-[#666]">ID</th>
                <th className="text-left p-3 font-medium text-[#666]">活动名称</th>
                <th className="text-left p-3 font-medium text-[#666]">状态</th>
                <th className="text-left p-3 font-medium text-[#666]">创建时间</th>
                <th className="text-center p-3 font-medium text-[#666]">操作</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(a => (
                <tr key={a.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="p-3 text-[#999]">{a.id}</td>
                  <td className="p-3 font-medium text-[#333]">{a.name}</td>
                  <td className="p-3">
                    <span className={`text-[12px] px-2 py-0.5 rounded-full ${a.status === 1 ? 'bg-[#f0fff4] text-[#22c55e]' : 'bg-[#f5f5f5] text-[#999]'}`}>
                      {a.status === 1 ? '上架' : '下架'}
                    </span>
                  </td>
                  <td className="p-3 text-[#999]">{a.createTime?.substring(0, 10)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(a)}
                        className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#666] transition-colors bg-transparent border-none cursor-pointer"
                        title={a.status === 1 ? '下架并退款' : '上架'}
                      >
                        {a.status === 1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <Link
                        href={`/console/activities/${a.id}/edit`}
                        className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#3b82f6] transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 rounded hover:bg-[#fee2e2] text-[#ef4444] transition-colors bg-transparent border-none cursor-pointer"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-[#f0f0f0] px-4 py-3 text-[13px] text-[#666] sm:flex-row sm:items-center sm:justify-between">
            <span>共 {total} 条，当前第 {page} / {pages} 页</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => loadData(page - 1)}
                className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]"
              >
                上一页
              </button>
              <button
                disabled={page >= pages}
                onClick={() => loadData(page + 1)}
                className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
