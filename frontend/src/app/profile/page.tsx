'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, CalendarDays, ShieldCheck, Ticket, Settings2, Image as ImageIcon, Loader2, Users, Clock3 } from 'lucide-react'
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
                onClick={() => router.push('/waitlist')}
                className="inline-flex items-center gap-2 rounded-full border border-[#ff1268] px-4 py-2 text-sm font-medium text-[#ff1268] transition-colors hover:bg-[#fff0f5]"
              >
                <Clock3 className="h-4 w-4" />
                我的候补
              </button>
              <button
                onClick={() => router.push('/profile/attendees')}
                className="inline-flex items-center gap-2 rounded-full border border-[#ff1268] px-4 py-2 text-sm font-medium text-[#ff1268] transition-colors hover:bg-[#fff0f5]"
              >
                <Users className="h-4 w-4" />
                实名观演人
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
            <div className="flex flex-col gap-6">
              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-[#fff0f5] ring-4 ring-[#fff0f5] shadow-inner">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.nickname || user.phone} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-11 w-11 text-[#ff1268]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[24px] font-bold text-[#111]">{user.nickname || '未设置昵称'}</h2>
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium shadow-sm"
                        style={{ color: authState?.color, backgroundColor: authState?.bg }}
                      >
                        {authState?.text}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#666] font-medium tracking-wide">绑定的手机号：{user.phone}</p>
                  </div>
                </div>

                <div className="mt-10 grid gap-5 sm:grid-cols-3">
                  <InfoItem icon={<Mail className="h-5 w-5" />} label="电子邮箱" value={user.email || '未设置'} />
                  <InfoItem icon={<ShieldCheck className="h-5 w-5" />} label="角色身份" value={user.role === 'admin' ? '平台管理员' : user.role === 'organizer' ? '活动主办方' : '普通用户'} />
                  <InfoItem icon={<CalendarDays className="h-5 w-5" />} label="注册时间" value={formatTime(user.createTime)} />
                </div>
              </section>

              <section className="rounded-3xl border border-[#ffe3ee] bg-gradient-to-br from-white to-[#fff7fa] p-6 shadow-sm flex items-start gap-4">
                <div className="p-2 bg-[#ff1268]/10 rounded-full shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#ff1268]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#111]">账户提示</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
                    为了您的账户安全，请不要随意将账号密码透露给他人。后台管理入口仅对“平台管理员”与“活动主办方”开放。如需申请成为主办方，请联系客服获取权限。
                  </p>
                </div>
              </section>
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
    <div className="rounded-2xl bg-[#fafafa] p-5 border border-gray-100/50 hover:bg-white hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500 group-hover:text-[#ff1268] transition-colors">
        <span className="text-gray-400 group-hover:text-[#ff1268] transition-colors">{icon}</span>
        {label}
      </div>
      <div className="mt-3 break-words text-[15px] font-semibold text-gray-900">{value}</div>
    </div>
  )
}
