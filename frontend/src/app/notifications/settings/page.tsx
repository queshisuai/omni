'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronLeft, Lock, MessageSquareText, Smartphone } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getNotificationPreferences } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import type { NotificationPreferenceVO } from '@/types/api'

function PreferenceIcon({ channel }: { channel: NotificationPreferenceVO['channel'] }) {
  if (channel === 'SMS') return <Smartphone className="h-5 w-5" />
  return <MessageSquareText className="h-5 w-5" />
}

export default function NotificationSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreferenceVO[]>([])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/notifications/settings')
      return
    }

    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getNotificationPreferences()
        if (active) setPreferences(data)
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : '加载通知偏好失败')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] bg-[#f7f8fa] px-5 py-8">
        <div className="mx-auto max-w-[960px]">
          <button
            type="button"
            onClick={() => router.push('/notifications')}
            className="mb-5 inline-flex items-center gap-1 border-none bg-transparent p-0 text-[13px] text-[#666] outline-none hover:text-[#ff1268]"
          >
            <ChevronLeft className="h-4 w-4" />
            返回消息中心
          </button>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0f5] text-[#ff1268]">
                <Bell className="h-5 w-5" />
              </div>
              <h1 className="text-[26px] font-semibold text-[#111]">通知偏好</h1>
              <p className="mt-2 text-[14px] leading-6 text-[#666]">站内消息保持开启，短信通知开放后可在这里开启。</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/notifications')}
              className="inline-flex items-center justify-center rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[14px] font-medium text-[#ff1268] outline-none hover:bg-[#fff0f5]"
            >
              查看消息
            </button>
          </div>

          {loading ? (
            <div className="text-[14px] text-[#666]">正在加载通知偏好...</div>
          ) : error ? (
            <div className="rounded-lg border border-[#ffd9e6] bg-white px-4 py-3 text-[14px] text-[#b91c1c]">{error}</div>
          ) : (
            <div className="grid gap-4">
              {preferences.map((item) => (
                <section key={item.channel} className="rounded-lg border border-[#ececec] bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#f7f8fa] text-[#ff1268]">
                        <PreferenceIcon channel={item.channel} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[17px] font-semibold text-[#111]">{item.label}</h2>
                          <span className={`rounded-full px-2 py-0.5 text-[12px] ${item.enabled ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f8fafc] text-[#64748b]'}`}>
                            {item.statusText}
                          </span>
                          {item.locked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7ed] px-2 py-0.5 text-[12px] text-[#b45309]">
                              <Lock className="h-3 w-3" />
                              不可修改
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[14px] leading-6 text-[#666]">{item.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled
                      aria-label={`${item.label}${item.enabled ? '已开启' : '未开启'}`}
                      className={`relative h-7 w-12 shrink-0 cursor-not-allowed rounded-full border-none outline-none ${item.enabled ? 'bg-[#ff1268]' : 'bg-[#d1d5db]'}`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${item.enabled ? 'left-6' : 'left-1'}`}
                      />
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
