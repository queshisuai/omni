'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Headphones } from 'lucide-react'

export function SupportFloatingButton() {
  const pathname = usePathname()
  const router = useRouter()
  if (pathname.startsWith('/login') || pathname.startsWith('/support') || pathname.startsWith('/console')) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => router.push('/help')}
      className="fixed bottom-24 right-5 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-[#ff1268] px-4 text-[14px] font-medium text-white shadow-lg shadow-[#ff1268]/25 hover:bg-[#e0105a] md:bottom-6"
      title="在线客服"
    >
      <Headphones className="h-5 w-5" />
      <span className="hidden sm:inline">在线客服</span>
    </button>
  )
}
