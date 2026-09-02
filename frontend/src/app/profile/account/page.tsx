'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { isAuthenticated } from '@/lib/auth'

export default function ProfileAccountRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(isAuthenticated() ? '/profile' : '/login?ru=/profile')
  }, [router])

  return (
    <>
      <Header />
      <main className="flex min-h-[420px] items-center justify-center bg-[#F7F8FA] px-4 py-10">
        <div className="rounded-2xl border border-[#FFD1E0] bg-white px-6 py-5 text-center text-sm font-medium text-[#E6005C] shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          正在跳转到个人中心…
        </div>
      </main>
      <Footer />
    </>
  )
}
