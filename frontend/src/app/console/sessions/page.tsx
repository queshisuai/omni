'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminActivities } from '@/lib/api'
import { listCategories } from '@/lib/api'
import type { ActivityEntity } from '@/types/api'

export default function SessionsPage() {
  const [activities, setActivities] = useState<ActivityEntity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser()
    if (!u) return
    listAdminActivities(u.userId, 1, 100).then(res => {
      setActivities(res.records)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-[22px] font-bold text-[#1a1a2e] mb-5">场次管理</h1>
      {loading ? (
        <div className="text-center text-[#999] py-20">加载中...</div>
      ) : activities.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          请先创建活动，再管理场次
        </div>
      ) : (
        <div className="text-[14px] text-[#666] bg-white rounded-xl border border-[#e5e5e5] p-6">
          <p className="mb-2">场次在创建活动时已关联设置。</p>
          <p>如需修改场次，请在活动编辑页面操作（功能开发中）。</p>
          <div className="mt-4 space-y-2">
            {activities.map(a => (
              <div key={a.id} className="p-3 border border-[#f0f0f0] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#333]">{a.name}</span>
                <a href={`/console/activities/${a.id}/edit`} className="text-[13px] text-[#ff1268]">编辑场次 →</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
