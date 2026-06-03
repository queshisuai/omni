'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, ShieldCheck, UserRound, Mail, Phone, CalendarDays, ClipboardList } from 'lucide-react'
import { getMyOrganizerApplication, getUserInfo } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canEnterConsole, getConsoleRoleLabel, isPlatformAdminRole } from '@/lib/console-auth'
import type { OrganizerApplicationVO, UserInfo } from '@/types/api'

function formatTime(value: string | null | undefined) {
  if (!value) return '未设置'
  return value.replace('T', ' ').slice(0, 19)
}

function statusText(status: number | null | undefined) {
  if (status === 1) return { text: '已通过', color: '#16a34a', bg: '#f0fdf4' }
  if (status === 2) return { text: '已禁用', color: '#ef4444', bg: '#fef2f2' }
  return { text: '正常', color: '#2563eb', bg: '#eff6ff' }
}

function applicationStatusText(status: OrganizerApplicationVO['status']) {
  if (status === 0) return { text: '待审核', color: '#ff7a00', bg: '#fff7ed' }
  if (status === 1) return { text: '已通过', color: '#16a34a', bg: '#f0fdf4' }
  return { text: '已驳回', color: '#ef4444', bg: '#fef2f2' }
}


export default function ConsoleProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [application, setApplication] = useState<OrganizerApplicationVO | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/console/profile')
      return
    }

    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const info = await getUserInfo()
        if (!active) return
        if (!canEnterConsole(info.role, info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        setUser(info)
        if (info.role === 'organizer') {
          try {
            const app = await getMyOrganizerApplication()
            if (active) setApplication(app)
          } catch {
            if (active) setApplication(null)
          }
        } else {
          setApplication(null)
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : '加载个人中心失败')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  const role = user?.role

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1a1a2e]">个人中心</h1>
        <p className="mt-2 text-sm text-[#666]">根据当前角色展示账号资料、主体信息与快捷入口。</p>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
          <div className="flex items-center gap-3 text-[#666]">
            <Loader2 className="h-5 w-5 animate-spin text-[#ff1268]" />
            正在加载个人中心...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-[#ff4d4f]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-[#ff1268] px-5 py-2 text-sm font-medium text-white"
          >
            重新加载
          </button>
        </div>
      ) : user ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#fff0f5] text-[#ff1268]">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : isPlatformAdminRole(role) ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#111]">
                  {isPlatformAdminRole(role) ? '平台管理员' : role === 'organizer' ? '商户主体信息' : getConsoleRoleLabel(role, user.permissionCodes || [])}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#666]">
                  {isPlatformAdminRole(role)
                    ? '展示管理员账号资料、安全状态与后台管理快捷入口。'
                    : role === 'organizer'
                      ? '展示商户主体资料、主办方状态和经营信息。'
                      : '展示当前后台账号资料和可访问的管理入口。'}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <InfoCard icon={<Phone className="h-4 w-4" />} title="手机号" value={user.phone} />
              <InfoCard icon={<UserRound className="h-4 w-4" />} title="昵称" value={user.nickname || '未设置'} />
              <InfoCard icon={<Mail className="h-4 w-4" />} title="邮箱" value={user.email || '未设置'} />
              <InfoCard icon={<CalendarDays className="h-4 w-4" />} title="注册时间" value={formatTime(user.createTime)} />
              <InfoCard icon={<ShieldCheck className="h-4 w-4" />} title="账号状态" value={statusText(user.status).text} />
              <InfoCard icon={<ClipboardList className="h-4 w-4" />} title="当前角色" value={getConsoleRoleLabel(role, user.permissionCodes || [])} />
            </div>

            {role === 'organizer' && application ? (
              <div className="mt-8 rounded-2xl border border-[#ececec] bg-[#fafafa] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#111]">入驻状态</span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ color: applicationStatusText(application.status).color, backgroundColor: applicationStatusText(application.status).bg }}
                  >
                    {applicationStatusText(application.status).text}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniField label="商户名称" value={application.organizerName} />
                  <MiniField label="主体类型" value={application.subjectType === 'enterprise' ? '企业' : '个人'} />
                  <MiniField label="联系人" value={application.contactName} />
                  <MiniField label="联系电话" value={application.contactPhone} />
                  <MiniField label="联系邮箱" value={application.contactEmail || '未设置'} />
                  <MiniField label="营业执照号" value={application.licenseNo || '未设置'} />
                </div>
                <div className="mt-4 text-sm leading-6 text-[#666]">
                  经营范围：{application.businessScope || '未填写'}
                </div>
                <div className="mt-2 text-sm leading-6 text-[#666]">
                  申请说明：{application.description || '未填写'}
                </div>
                {application.status === 2 && application.reviewNote ? (
                  <div className="mt-3 text-sm leading-6 text-[#111]">驳回原因：{application.reviewNote}</div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <h3 className="text-[18px] font-semibold text-[#111]">快捷入口</h3>
              <div className="mt-5 grid gap-3">
                {isPlatformAdminRole(role) ? (
                  <>
                    <ActionLink href="/console/organizer-applications" title="主办方管理" desc="管理主办方入驻申请" />
                    <ActionLink href="/console/venue" title="场馆记录" desc="创建和维护场馆记录" />
                  </>
                ) : role === 'organizer_admin' ? (
                  <ActionLink href="/console/organizer-admins" title="主办方管理员" desc="分配和解除主办方管理员账号" />
                ) : role === 'support' ? (
                  <>
                    {user.permissionCodes?.includes('support.account.manage') ? <ActionLink href="/console/support-accounts" title="客服账号管理" desc="创建、编辑和停用客服账号" /> : null}
                    {user.permissionCodes?.includes('support.conversation.view') ? <ActionLink href="/console/support-conversations" title="客服会话查询" desc="查看人工客服会话记录" /> : null}
                    {user.permissionCodes?.includes('audit.view') ? <ActionLink href="/console/audit-logs" title="操作审计" desc="查看后台人工操作日志" /> : null}
                  </>
                ) : (
                  <>
                    <ActionLink href="/console/activities" title="活动管理" desc="管理自有活动与内容" />
                    <ActionLink href="/console/orders" title="订单查看" desc="查看商户相关订单" />
                  </>
                )}
                <ActionLink href="/profile/account" title="账号设置" desc="修改昵称、邮箱、头像和密码" />
              </div>
            </section>

            <section className="rounded-xl border border-[#ffe3ee] bg-gradient-to-br from-white to-[#fff7fa] p-6 shadow-sm">
              <h3 className="text-[18px] font-semibold text-[#111]">角色说明</h3>
              <p className="mt-3 text-sm leading-6 text-[#666]">
                {isPlatformAdminRole(role)
                  ? '管理员可访问所有后台功能，并可进入主办方管理页面处理主办方申请。'
                  : role === 'organizer'
                    ? '主办方可查看自己的商户主体信息和入驻状态，并进入商户后台进行业务管理。'
                    : role === 'organizer_admin'
                      ? '主办方管理员负责主办方管理员账号的分配、解除和状态维护，不等同于主办方商户账号。'
                      : '客服主管负责客服账号、客服会话和审计查看等后台管理工作；普通客服仍以客服工作台处理在线咨询。'}
              </p>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fafafa] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[#999]">
        <span className="text-[#ff1268]">{icon}</span>
        {title}
      </div>
      <div className="mt-2 break-words text-sm text-[#111]">{value}</div>
    </div>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3">
      <div className="text-xs text-[#999]">{label}</div>
      <div className="mt-1 text-sm text-[#111]">{value}</div>
    </div>
  )
}

function ActionLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-4 text-left transition-colors hover:border-[#ff1268]/30 hover:bg-[#fff0f5]"
    >
      <div className="text-sm font-medium text-[#111]">{title}</div>
      <div className="mt-1 text-xs text-[#666]">{desc}</div>
    </a>
  )
}
