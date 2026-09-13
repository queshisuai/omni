'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Headphones } from 'lucide-react'

export default function SupportConversationsCompatibilityPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/console/customer-service/sessions')
  }, [router])

  return (
    <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#9ca3af]">
      <Headphones className="h-5 w-5" />
      正在进入客服工作台...
    </div>
  )
}
