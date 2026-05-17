'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, CalendarDays, ShieldCheck, Ticket, Settings2, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getUserInfo } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import type { UserInfo } from '@/types/api'

function formatTime(value: string | null | undefined) {
  if (!value) return '未设置'
  return value.replace('T', ' ').slice(0, 19)
}

function authLabel(status: number) {
  if (status === 1) return { text: '已启用', color: '#52c41a', bg: '#f6ffed' }
  if (status === 0) return { text: '未启用', color: '#faad14', bg: '#fffbe6' }
  return { text: '已禁用', color: '#ff4d4f', bg: '#fff1f0' }
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/profile')
      return
    }

    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getUserInfo()
        if (active) setUser(data)
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : '加载用户信息失败')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  const authState = user ? authLabel(user.status) : null

  return (
    <>
      <Header />
      <main className="bg-[#f7f8fa] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold text-[#111]">个人中心</h1>
              <p className="mt-2 text-sm text-[#666]">查看当前账户资料，快速进入订单和账号设置。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/orders')}
                className="inline-flex items-center gap-2 rounded-full border border-[#ff1268] px-4 py-2 text-sm font-medium text-[#ff1268] transition-colors hover:bg-[#fff0f5]"
              >
                <Ticket className="h-4 w-4" />
                订单管理
              </button>
              <button
                onClick={() => router.push('/profile/account')}
                className="inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-[#ff1268]/20 transition-colors hover:bg-[#e60f5f]"
              >
                <Settings2 className="h-4 w-4" />
                账号设置
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-[#ececec] bg-white shadow-sm">
              <div className="flex items-center gap-3 text-[#666]">
                <Loader2 className="h-5 w-5 animate-spin text-[#ff1268]" />
                正在加载个人信息...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-[#ffd9e6] bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-[#ff4d4f]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-[#ff1268] px-5 py-2 text-sm font-medium text-white"
              >
                重新加载
              </button>
            </div>
          ) : user ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-[#fff0f5] ring-4 ring-[#fff0f5]">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.nickname || user.phone} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-11 w-11 text-[#ff1268]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[22px] font-semibold text-[#111]">{user.nickname || '未设置昵称'}</h2>
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                        style={{ color: authState?.color, backgroundColor: authState?.bg }}
                      >
                        {authState?.text}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#666]">手机号 {user.phone}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#666]">
                      <span className="rounded-full bg-[#fafafa] px-3 py-1">账号状态：{user.status}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <InfoItem icon={<Phone className="h-4 w-4" />} label="手机号" value={user.phone} />
                  <InfoItem icon={<User className="h-4 w-4" />} label="昵称" value={user.nickname || '未设置'} />
                  <InfoItem icon={<Mail className="h-4 w-4" />} label="邮箱" value={user.email || '未设置'} />
                  <InfoItem icon={<ImageIcon className="h-4 w-4" />} label="头像" value={user.avatar || '未设置'} />
                  <InfoItem icon={<CalendarDays className="h-4 w-4" />} label="注册时间" value={formatTime(user.createTime)} />
                  <InfoItem icon={<ShieldCheck className="h-4 w-4" />} label="账号状态" value={authState?.text || '未知'} />
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#111]">快捷入口</h3>
                  <div className="mt-5 grid gap-3">
                    <button
                      onClick={() => router.push('/orders')}
                      className="rounded-2xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-4 text-left transition-colors hover:border-[#ff1268]/30 hover:bg-[#fff0f5]"
                    >
                      <div className="text-sm font-medium text-[#111]">订单管理</div>
                      <div className="mt-1 text-xs text-[#666]">查看历史订单和支付状态</div>
                    </button>
                    <button
                      onClick={() => router.push('/profile/account')}
                      className="rounded-2xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-4 text-left transition-colors hover:border-[#ff1268]/30 hover:bg-[#fff0f5]"
                    >
                      <div className="text-sm font-medium text-[#111]">账号设置</div>
                      <div className="mt-1 text-xs text-[#666]">修改昵称、邮箱、头像和密码</div>
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-[#ffe3ee] bg-gradient-to-br from-white to-[#fff7fa] p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#111]">账户提示</h3>
                  <p className="mt-3 text-sm leading-6 text-[#666]">
                    当前页面仅展示 C 端个人信息与订单入口，不提供主办方申请和后台入口。
                  </p>
                </section>
              </aside>
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fafafa] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[#999]">
        <span className="text-[#ff1268]">{icon}</span>
        {label}
      </div>
      <div className="mt-2 break-words text-sm text-[#111]">{value}</div>
    </div>
  )
}
