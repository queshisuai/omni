'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, isAuthenticated, logout } from '@/lib/auth'
import { LayoutDashboard, CalendarDays, MapPin, ShoppingCart, Clock, LogOut, Menu, X } from 'lucide-react'

const menuItems = [
  { href: '/console', label: '概览', icon: LayoutDashboard },
  { href: '/console/activities', label: '活动管理', icon: CalendarDays },
  { href: '/console/sessions', label: '场次管理', icon: Clock },
  { href: '/console/orders', label: '订单查看', icon: ShoppingCart },
  { href: '/console/venue', label: '场馆管理', icon: MapPin },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    const user = getUser()
    if (!user || (user.role !== 'admin' && user.role !== 'organizer')) {
      router.push('/')
      return
    }
    setNickname(user.nickname || user.phone || '')
    setRole(user.role || '')
  }, [router])

  const handleLogout = () => logout()

  return (
    <div className="min-h-screen bg-[#f5f6f7] flex">
      {/* 侧边栏 */}
      <aside className={`w-[240px] bg-[#1a1a2e] text-white flex-shrink-0 flex flex-col ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden'} lg:flex lg:relative`}>
        <div className="p-5 border-b border-[#2a2a4e] flex items-center justify-between">
          <Link href="/console" className="text-[18px] font-bold text-[#ff1268]">主办方后台</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3">
          {menuItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/console' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1 text-[14px] transition-colors ${
                  active ? 'bg-[#ff1268] text-white' : 'text-[#a0a0b8] hover:bg-[#2a2a4e] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[#2a2a4e]">
          <div className="text-[12px] text-[#666] mb-1">
            {role === 'admin' ? '平台管理员' : '主办方'}
          </div>
          <div className="text-[14px] text-white mb-3">{nickname}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-[13px] text-[#a0a0b8] hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 遮罩 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 主内容 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="bg-white h-[56px] border-b border-[#e5e5e5] flex items-center px-5 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3 text-[#333] bg-transparent border-none cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link href="/" className="text-[13px] text-[#666] hover:text-[#ff1268]">
            返回前台
          </Link>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
