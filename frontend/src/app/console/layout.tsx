'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, isAuthenticated, logout, updateStoredUser } from '@/lib/auth'
import { getUserInfo } from '@/lib/api'
import { LayoutDashboard, CalendarDays, MapPin, ShoppingCart, Clock, LogOut, Menu, X, RotateCcw, UserCircle2, ClipboardList, PlusCircle, AlertTriangle } from 'lucide-react'

const menuItems = [
  { href: '/console', label: '概览', icon: LayoutDashboard },
  { href: '/console/activities', label: '平台活动管理', icon: CalendarDays, roles: ['admin'] },
  { href: '/console/sessions', label: '场次管理', icon: Clock },
  { href: '/console/orders', label: '订单查看', icon: ShoppingCart },
  { href: '/console/refunds', label: '退款审核', icon: RotateCcw },
  { href: '/console/risk-resolutions', label: '恢复售票审核', icon: AlertTriangle, roles: ['admin'] },
  { href: '/console/risk-cases', label: '风险案例管理', icon: AlertTriangle, roles: ['admin'] },
  { href: '/console/venue', label: '场馆管理', icon: MapPin, roles: ['admin'] },
  { href: '/console/venue/applications', label: '场馆审核', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/organizer-applications', label: '入驻审核', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/profile', label: '个人中心', icon: UserCircle2 },
]

const organizerMenuItems = [
  { href: '/console', label: '概览', icon: LayoutDashboard },
  { href: '/console/tours', label: '我的演出', icon: CalendarDays },
  { href: '/console/tours/new', label: '创建我的演出', icon: PlusCircle },
  { href: '/console/activities', label: '我的活动管理', icon: CalendarDays },
  { href: '/console/sessions', label: '我的场次管理', icon: Clock },
  { href: '/console/risk-events', label: '风险事件待办', icon: AlertTriangle },
  { href: '/console/refunds', label: '主办方退款处理', icon: RotateCcw },
  { href: '/console/venue/apply', label: '场地申请记录', icon: MapPin },
  { href: '/console/orders', label: '订单', icon: ShoppingCart },
  { href: '/console/profile', label: '个人中心', icon: UserCircle2 },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const visibleMenuItems = useMemo(() => {
    if (checking || !role) return []
    if (role === 'organizer') return organizerMenuItems
    return menuItems.filter((item) => {
      if (!('roles' in item) || !item.roles) return true
      return item.roles.includes(role as 'admin' | 'organizer')
    })
  }, [checking, role])
  const activeMenuHref = useMemo(() => {
    let bestMatch = ''

    for (const item of visibleMenuItems) {
      if (pathname === item.href) return item.href
      if (item.href === '/console') continue
      if (pathname.startsWith(`${item.href}/`) && item.href.length > bestMatch.length) {
        bestMatch = item.href
      }
    }

    return bestMatch
  }, [pathname, visibleMenuItems])

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    let active = true
    ;(async () => {
      const cached = getUser()
      try {
        const latest = await getUserInfo()
        if (!active) return
        if (latest.role !== 'admin' && latest.role !== 'organizer') {
          router.push('/')
          return
        }
        updateStoredUser({ nickname: latest.nickname, role: latest.role })
        setNickname(latest.nickname || latest.phone || '')
        setRole(latest.role)
      } catch {
        if (!active) return
        if (!cached || (cached.role !== 'admin' && cached.role !== 'organizer')) {
          router.push('/')
          return
        }
        setNickname(cached.nickname || cached.phone || '')
        setRole(cached.role || '')
      } finally {
        if (active) setChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [router])

  const handleLogout = () => logout()
  const roleReady = !checking && Boolean(role)
  const brandLabel = roleReady ? role === 'admin' ? '平台后台' : '主办方后台' : '后台'
  const roleLabel = roleReady ? role === 'admin' ? '平台管理员' : '主办方' : '校验中'

  return (
    <div className="min-h-screen bg-[#f5f6f7] flex">
      {/* 侧边栏 */}
      <aside className={`w-[240px] bg-[#1a1a2e] text-white flex-shrink-0 flex flex-col ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden'} lg:flex lg:relative`}>
        <div className="p-5 border-b border-[#2a2a4e] flex items-center justify-between">
          <Link href="/console" className="text-[18px] font-bold text-[#ff1268]">{brandLabel}</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3">
          {visibleMenuItems.map(item => {
            const Icon = item.icon
            const active = item.href === activeMenuHref
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
            {roleLabel}
          </div>
          <div className="text-[14px] text-white mb-3">{nickname}</div>
          <div className="flex flex-col gap-2">
            <Link
              href="/console/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 text-[13px] text-[#a0a0b8] hover:text-white transition-colors"
            >
              <UserCircle2 className="w-4 h-4" />
              个人中心
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[13px] text-[#a0a0b8] hover:text-white transition-colors bg-transparent border-none cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
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
          {checking ? <div className="text-[14px] text-[#666]">正在校验后台权限...</div> : children}
        </main>
      </div>
    </div>
  )
}
