'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminActivities } from '@/lib/api'
import { CalendarDays, ShoppingCart, Ticket } from 'lucide-react'

export default function ConsoleHome() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null)
  const [stats, setStats] = useState({ activityCount: 0 })

  useEffect(() => {
    const u = getUser()
    setUser(u)
    if (u) {
      listAdminActivities(u.userId, { page: 1, size: 1 }).then(res => {
        setStats({ activityCount: res.total })
      }).catch(() => {})
    }
  }, [])

  return (
    <div>
      <h1 className="text-[24px] font-bold text-[#1a1a2e] mb-6">
        {user?.role === 'admin' ? '平台管理后台' : '主办方后台'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#fff0f3] flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-[#ff1268]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">{stats.activityCount}</div>
              <div className="text-[13px] text-[#999]">我的活动</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#f0f7ff] flex items-center justify-center">
              <Ticket className="w-6 h-6 text-[#3b82f6]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">-</div>
              <div className="text-[13px] text-[#999]">总票档数</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#f0fff4] flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-[#22c55e]" />
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#1a1a2e]">-</div>
              <div className="text-[13px] text-[#999]">总订单数</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e5e5e5]">
        <h2 className="text-[16px] font-bold text-[#1a1a2e] mb-4">快速入口</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '新建活动', href: '/console/activities/new', color: '#ff1268' },
            { label: '管理活动', href: '/console/activities', color: '#3b82f6' },
            { label: '场馆管理', href: '/console/venue', color: '#22c55e' },
            { label: '查看订单', href: '/console/orders', color: '#f59e0b' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="block text-center py-3 px-4 rounded-lg border border-[#e5e5e5] text-[14px] font-medium hover:border-current transition-colors"
              style={{ color: item.color }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
