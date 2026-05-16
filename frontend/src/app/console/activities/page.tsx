'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { listAdminActivities, deleteAdminActivity, updateActivityStatus } from '@/lib/api'
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import type { ActivityEntity } from '@/types/api'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityEntity[]>([])
  const [userId, setUserId] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    listAdminActivities(u.userId).then(res => {
      setActivities(res.records)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleToggleStatus = async (activity: ActivityEntity) => {
    const newStatus = activity.status === 1 ? 0 : 1
    await updateActivityStatus(activity.id, { userId, status: newStatus })
    loadData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该活动？')) return
    await deleteAdminActivity(id, userId)
    loadData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">活动管理</h1>
        <Link
          href="/console/activities/new"
          className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors"
        >
          <Plus className="w-4 h-4" /> 新建活动
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-[#999] py-20 text-[14px]">加载中...</div>
      ) : activities.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无活动，点击右上角新建
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
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
                        title={a.status === 1 ? '下架' : '上架'}
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
        </div>
      )}
    </div>
  )
}
