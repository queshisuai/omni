'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { globalConfirm } from '@/components/GlobalDialog'
import { captureAnalyticsEvent } from '@/lib/analytics'
import { markSearchReturnPending, readSearchReturnState } from '@/lib/search-return-state'

interface FloatingBackButtonProps {
  fallbackHref?: string
  label?: string
  pendingInteraction?: boolean
  analyticsEvent?: string
  analyticsPayload?: Record<string, unknown>
}

export function FloatingBackButton({
  fallbackHref = '/',
  label = '返回上一页',
  pendingInteraction = false,
  analyticsEvent = 'omni_activity_detail_back_clicked',
  analyticsPayload = {},
}: FloatingBackButtonProps) {
  const router = useRouter()

  const handlePageBack = async () => {
    if (pendingInteraction) {
      const confirmed = await globalConfirm('当前有未完成操作，确认返回吗？')
      if (!confirmed) return
    }

    captureAnalyticsEvent(analyticsEvent, {
      source: 'floating_back',
      ...analyticsPayload,
    })

    const searchReturnState = readSearchReturnState()
    if (searchReturnState?.url) {
      markSearchReturnPending()
      router.push(searchReturnState.url)
      return
    }

    if (typeof window !== 'undefined'
      && window.history.length > 1
      && document.referrer.includes(window.location.host)) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={() => void handlePageBack()}
      className="group fixed left-6 top-24 z-40 hidden lg:flex h-11 items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 pr-5 text-[14px] font-medium text-gray-700 shadow-md backdrop-blur-md transition-all duration-200 hover:border-[#FFD6E4] hover:text-[#FF1475] hover:shadow-lg"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:bg-[#FFF0F5] group-hover:text-[#FF1475]">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </button>
  )
}
