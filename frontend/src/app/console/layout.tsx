'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, isAuthenticated, logout, updateStoredUser } from '@/lib/auth'
import { getUserInfo } from '@/lib/api'
import { canAccessConsolePath, canEnterConsole } from '@/lib/console-auth'
import { isConsolePathAllowedForRole } from '@/lib/console-paths'
import { LayoutDashboard, CalendarDays, MapPin, ShoppingCart, Clock, LogOut, Menu, X, RotateCcw, UserCircle2, ClipboardList, AlertTriangle, Users, GitPullRequestArrow, Headphones, ShieldAlert, FileSearch, ShieldCheck } from 'lucide-react'

const menuItems = [
  { href: '/console', label: '概览', icon: LayoutDashboard },
  { href: '/console/activities', label: '活动发布管理', icon: CalendarDays, roles: ['admin'] },
  { href: '/console/tours', label: '巡演草稿管理', icon: GitPullRequestArrow, roles: ['admin'] },
  { href: '/console/sessions', label: '场次管理', icon: Clock },
  { href: '/console/orders', label: '订单查看', icon: ShoppingCart },
  { href: '/console/refunds', label: '退款审核', icon: RotateCcw },
  { href: '/console/artists', label: '艺人管理', icon: Users, roles: ['admin'] },
  { href: '/console/artists/pending', label: '艺人档案审核', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/risk-resolutions', label: '恢复售票审核', icon: AlertTriangle, roles: ['admin'] },
  { href: '/console/risk-cases', label: '风险案例管理', icon: AlertTriangle, roles: ['admin'] },
  { href: '/console/venue', label: '场馆记录', icon: MapPin, roles: ['admin'] },
  { href: '/console/venue/applications', label: '场馆资料审核', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/station-config-reviews', label: '站点变更审核', icon: GitPullRequestArrow, roles: ['admin'] },
  { href: '/console/organizer-applications', label: '主办方管理', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/support-accounts', label: '客服账号管理', icon: Headphones, roles: ['admin'] },
  { href: '/console/support-conversations', label: '客服会话记录', icon: Headphones, roles: ['admin'] },
  { href: '/console/roles', label: '角色权限', icon: ShieldCheck, roles: ['admin'] },
  { href: '/console/organizer-admins', label: '主办方管理员', icon: Users, roles: ['admin'] },
  { href: '/console/audit-logs', label: '操作审计', icon: ClipboardList, roles: ['admin'] },
  { href: '/console/exception-tasks', label: '异常任务', icon: ShieldAlert, roles: ['admin'] },
  { href: '/console/reconciliation', label: '日结对账', icon: FileSearch, roles: ['admin'] },
  { href: '/console/profile', label: '个人中心', icon: UserCircle2 },
]

const organizerMenuItems = [
  { href: '/console', label: '概览', icon: LayoutDashboard },
  { href: '/console/activities', label: '我的活动管理', icon: CalendarDays },
  { href: '/console/tours', label: '巡演草稿', icon: GitPullRequestArrow },
  { href: '/console/sessions', label: '我的场次管理', icon: Clock },
  { href: '/console/artists', label: '我的艺人', icon: Users },
  { href: '/console/risk-events', label: '风险事件待办', icon: AlertTriangle },
  { href: '/console/refunds', label: '主办方退款处理', icon: RotateCcw },
  { href: '/console/venue', label: '场馆记录', icon: MapPin },
  { href: '/console/venue/apply', label: '提交场馆资料', icon: MapPin },
  { href: '/console/orders', label: '订单', icon: ShoppingCart },
  { href: '/console/profile', label: '个人中心', icon: UserCircle2 },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [role, setRole] = useState('')
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const visibleMenuItems = useMemo(() => {
    if (checking || !role) return []
    if (role === 'admin') {
      return menuItems
    }
    if (permissionCodes.length > 0) {
      return menuItems.filter((item) => {
        return canAccessConsolePath(item.href, permissionCodes)
      })
    }
    if (role === 'organizer') return organizerMenuItems
    return menuItems.filter((item) => {
      if (!('roles' in item) || !item.roles) return true
      return item.roles.includes(role as 'admin' | 'organizer')
    })
  }, [checking, role, permissionCodes])
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
    setRedirecting(false)
    ;(async () => {
      const cached = getUser()
      try {
        const latest = await getUserInfo()
        if (!active) return
        const latestPermissions = latest.permissionCodes || []
        if (!canEnterConsole(latest.role, latestPermissions)) {
          router.push('/')
          return
        }
        updateStoredUser({ nickname: latest.nickname, role: latest.role, permissionCodes: latestPermissions })
        setNickname(latest.nickname || latest.phone || '')
        setAvatar(latest.avatar || '')
        setRole(latest.role)
        setPermissionCodes(latestPermissions)
        if (latest.role !== 'admin') {
          if (latestPermissions.length > 0) {
            if (!canAccessConsolePath(pathname, latestPermissions)) {
              setRedirecting(true)
              router.replace('/console')
              return
            }
          } else if (!isConsolePathAllowedForRole(latest.role, pathname)) {
            setRedirecting(true)
            router.replace('/console')
            return
          }
        }
      } catch {
        if (!active) return
        const cachedPermissions = cached?.permissionCodes || []
        if (!cached || !canEnterConsole(cached.role, cachedPermissions)) {
          router.push('/')
          return
        }
        setNickname(cached.nickname || cached.phone || '')
        setRole(cached.role || '')
        setPermissionCodes(cachedPermissions)
        if (cached.role !== 'admin') {
          if (cachedPermissions.length > 0) {
            if (!canAccessConsolePath(pathname, cachedPermissions)) {
              setRedirecting(true)
              router.replace('/console')
              return
            }
          } else if (!isConsolePathAllowedForRole(cached.role, pathname)) {
            setRedirecting(true)
            router.replace('/console')
            return
          }
        }
      } finally {
        if (active) setChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [router, pathname])

  const handleLogout = () => logout()
  const roleReady = !checking && Boolean(role)
  const brandLabel = roleReady ? role === 'admin' ? '平台后台' : role === 'support' ? '客服后台' : role === 'organizer_admin' ? '主办方管理后台' : '主办方后台' : '后台'
  const roleLabel = roleReady ? role === 'admin' ? '平台管理员' : role === 'support' ? '客服人员' : role === 'organizer_admin' ? '主办方管理员' : '主办方' : '校验中'

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* 侧边栏 */}
      <aside className={`w-[240px] bg-white border-r border-gray-200 flex-shrink-0 flex flex-col ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden'} lg:flex lg:relative transition-all duration-300`}>
        <div className="h-[64px] px-6 flex items-center justify-between">
          <Link href="/console" className="text-[18px] font-bold text-[#ff1268] tracking-tight">{brandLabel}</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          {visibleMenuItems.map(item => {
            const Icon = item.icon
            const active = item.href === activeMenuHref
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[14px] transition-all duration-200 ${
                  active
                    ? 'bg-[#fff0f5] text-[#ff1268] font-semibold'
                    : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex flex-col mb-4 px-2">
            <span className="text-[12px] text-gray-500 font-medium mb-2">{roleLabel}</span>
            <div className="flex items-center gap-2.5">
              {avatar ? (
                <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                  <UserCircle2 className="w-5 h-5" />
                </div>
              )}
              <span className="text-[14px] text-gray-900 font-semibold truncate">{nickname}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Link
              href="/console/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all"
            >
              <UserCircle2 className="w-4 h-4" />
              个人中心
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all outline-none w-full text-left"
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
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* 顶部栏 */}
        <header className="bg-white h-[64px] border-b border-gray-200 flex items-center px-6 flex-shrink-0 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors outline-none">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link
            href="/"
            className="flex items-center justify-center px-4 py-1.5 rounded-md border border-gray-200 text-[13px] font-medium text-gray-600 hover:text-[#ff1268] hover:border-[#ff1268]/30 hover:bg-[#fff0f5] transition-all bg-white"
          >
            返回前台
          </Link>
        </header>
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto">
            {checking || redirecting ? <div className="text-[14px] text-[#666] flex items-center justify-center py-20">正在校验后台权限...</div> : children}
          </div>
        </main>
      </div>
    </div>
  )
}
