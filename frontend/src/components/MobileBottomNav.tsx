'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Ticket, UserRound } from 'lucide-react'

const items = [
  { href: '/', label: '首页', icon: Home },
  { href: '/search', label: '分类', icon: Search },
  { href: '/tickets', label: '票夹', icon: Ticket },
  { href: '/profile', label: '我的', icon: UserRound },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/console') || pathname.startsWith('/support')) {
    return null
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.35)] backdrop-blur md:hidden">
      <div className="grid h-14 grid-cols-4">
        {items.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-[#ff1268]' : 'text-gray-500'}`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
