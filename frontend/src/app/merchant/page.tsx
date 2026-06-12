'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, UserRound, Building2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getMyOrganizerApplication, getUserInfo, submitOrganizerApplication } from '@/lib/api'
import { getUser, isAuthenticated, updateUserRole } from '@/lib/auth'
import type { OrganizerApplicationStatus, OrganizerApplicationVO, SubjectType, UserInfo, UserRole } from '@/types/api'

type ApplicationFormState = {
  organizerName: string
  subjectType: SubjectType
  contactName: string
  contactPhone: string
  contactEmail: string
  licenseNo: string
  businessScope: string
  description: string
}

const EMPTY_FORM: ApplicationFormState = {
  organizerName: '',
  subjectType: 'enterprise',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  licenseNo: '',
  businessScope: '',
  description: '',
}

function statusMeta(status: OrganizerApplicationStatus | number | string | null | undefined) {
  if (status === 0) return { text: '待审核', color: '#ff7a00', bg: '#fff7ed' }
  if (status === 1) return { text: '已通过', color: '#16a34a', bg: '#f0fdf4' }
  if (status === 2) return { text: '已驳回', color: '#ef4444', bg: '#fef2f2' }
  return { text: '未知入驻状态', color: '#6b7280', bg: '#f3f4f6' }
}

function statusDescription(status: OrganizerApplicationStatus | number | string | null | undefined) {
  if (status === 0) return '资料正在审核中。'
  if (status === 1) return '已通过，可进入后台。'
  if (status === 2) return '驳回后可修改后重新提交。'
  return '入驻状态待核对，请稍后刷新或联系平台客服。'
}

function currentQualificationMeta(isCancelled: boolean, application?: OrganizerApplicationVO | null) {
  if (isCancelled) return { text: '主办方资格已取消', color: '#7c3aed', bg: '#f5f3ff' }
  if (!application) return null
  return statusMeta(application.status)
}

function roleLabel(role?: UserRole | null) {
  if (role === 'admin') return '平台管理员'
  if (role === 'platform_super_admin') return '平台超管'
  if (role === 'organizer') return '商户账号'
  if (role === 'organizer_admin') return '平台主办方运营员'
  return '普通用户'
}

export default function MerchantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [role, setRole] = useState<UserRole | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [application, setApplication] = useState<OrganizerApplicationVO | null>(null)
  const [form, setForm] = useState<ApplicationFormState>(EMPTY_FORM)

  useEffect(() => {
    if (!isAuthenticated()) {
      setAuthenticated(false)
      setLoading(false)
      return
    }

    setAuthenticated(true)
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const currentUser = getUser()
        const currentRole = currentUser?.role || 'user'
        setRole(currentRole)

        const info = await getUserInfo()
        if (!active) return
        setUserInfo(info)
        setRole(info.role)

        if (info.role === 'admin' || info.role === 'platform_super_admin' || info.role === 'organizer') {
          setLoading(false)
          return
        }

        const data = await getMyOrganizerApplication()
        if (!active) return
        setApplication(data)
        const isCancelled = info.organizerStatus === 3 && info.role === 'user'
        if (data?.status === 1 && !isCancelled) {
          updateUserRole('organizer')
          setRole('organizer')
        }
        if (data) {
          setForm({
            organizerName: data.organizerName || '',
            subjectType: data.subjectType,
            contactName: data.contactName || '',
            contactPhone: data.contactPhone || '',
            contactEmail: data.contactEmail || '',
            licenseNo: data.licenseNo || '',
            businessScope: data.businessScope || '',
            description: data.description || '',
          })
        } else {
          setForm(EMPTY_FORM)
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载商户入驻信息失败')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  const isCancelledOrganizer = userInfo?.organizerStatus === 3 && userInfo?.role === 'user'
  const statusInfo = useMemo(() => currentQualificationMeta(isCancelledOrganizer, application), [application, isCancelledOrganizer])
  const canEditForm = isCancelledOrganizer || !application || application.status === 0 || application.status === 2
  const isApproved = !isCancelledOrganizer && application?.status === 1

  const handleChange = (key: keyof ApplicationFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const data = await submitOrganizerApplication({
        organizerName: form.organizerName.trim(),
        subjectType: form.subjectType,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || null,
        licenseNo: form.licenseNo.trim() || null,
        businessScope: form.businessScope.trim() || null,
        description: form.description.trim() || null,
      })
      setApplication(data)
      if (data.status === 1) {
        updateUserRole('organizer')
      }
      setForm({
        organizerName: data.organizerName || '',
        subjectType: data.subjectType,
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        licenseNo: data.licenseNo || '',
        businessScope: data.businessScope || '',
        description: data.description || '',
      })
      setMessage('提交成功，已更新为最新申请状态。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交申请失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header />
      <main className="bg-[#f7f8fa] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff0f5] px-3 py-1 text-xs font-medium text-[#ff1268]">
                <Building2 className="h-3.5 w-3.5" />
                商户入驻
              </div>
              <h1 className="mt-3 text-[28px] font-semibold text-[#111]">成为万象商户</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666]">
                提交入驻申请后，平台将根据资料进行审核。已通过的商户可以直接进入后台管理。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {role === 'admin' || role === 'platform_super_admin' || role === 'organizer' || isApproved ? (
                <button
                  onClick={() => router.push('/console')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-[#ff1268]/20 transition-colors hover:bg-[#e60f5f]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  进入商户后台
                </button>
              ) : null}
            </div>
          </div>

          {authenticated === false ? (
            <div className="rounded-3xl border border-[#ececec] bg-white p-8 text-center shadow-sm sm:p-12">
              <UserRound className="mx-auto h-12 w-12 text-[#ff1268]" />
              <h2 className="mt-4 text-[22px] font-semibold text-[#111]">登录后继续申请商户入驻</h2>
              <p className="mt-2 text-sm leading-6 text-[#666]">
                你需要先登录账号，系统才会根据当前登录用户展示入驻申请或后台入口。
              </p>
              <button
                onClick={() => router.push('/login?ru=/merchant')}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-5 py-3 text-sm font-medium text-white shadow-sm shadow-[#ff1268]/20 transition-colors hover:bg-[#e60f5f]"
              >
                去登录
              </button>
            </div>
          ) : loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-[#ececec] bg-white shadow-sm">
              <div className="flex items-center gap-3 text-[#666]">
                <Loader2 className="h-5 w-5 animate-spin text-[#ff1268]" />
                正在加载商户入驻信息...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-[#ffd9e6] bg-white p-6 text-center shadow-sm">
              <AlertCircle className="mx-auto h-10 w-10 text-[#ff4d4f]" />
              <p className="mt-3 text-sm text-[#ff4d4f]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-[#ff1268] px-5 py-2 text-sm font-medium text-white"
              >
                重新加载
              </button>
            </div>
          ) : role === 'admin' || role === 'platform_super_admin' || role === 'organizer' || isApproved ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#ff1268]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#111]">当前账号可直接进入商户后台</h2>
                    <p className="mt-2 text-sm leading-6 text-[#666]">
                      你当前登录的是{roleLabel(role)}，无需再次提交入驻申请。
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <InfoCard icon={<UserRound className="h-4 w-4" />} title="账号角色" value={roleLabel(role)} />
                  <InfoCard icon={<ShieldCheck className="h-4 w-4" />} title="可用操作" value="查看和管理商户后台" />
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-3xl border border-[#ffe3ee] bg-gradient-to-br from-white to-[#fff7fa] p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#111]">后台入口</h3>
                  <p className="mt-3 text-sm leading-6 text-[#666]">
                    点击下方按钮直接前往商户后台，进行活动、场次和订单相关管理。
                  </p>
                  <button
                    onClick={() => router.push('/console')}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#ff1268]/20 transition-colors hover:bg-[#e60f5f]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    进入商户后台
                  </button>
                </section>
              </aside>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#ff1268]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#111]">商户入驻申请</h2>
                    <p className="mt-2 text-sm leading-6 text-[#666]">
                      填写真实资料后提交。待审核和驳回状态都可以继续编辑并重新提交。
                    </p>
                  </div>
                </div>

                {application ? (
                  <div
                    className="mt-6 rounded-2xl border px-4 py-3 text-sm"
                    style={{ color: statusInfo?.color, backgroundColor: statusInfo?.bg, borderColor: `${statusInfo?.color}22` }}
                  >
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      当前状态：{statusInfo?.text}
                    </div>
                    <div className="mt-1 text-[#666]">
                      {isCancelledOrganizer
                        ? '主办方资格已取消，可重新提交入驻申请。'
                        : statusDescription(application.status)}
                    </div>
                    {application.status === 2 && application.reviewNote ? (
                      <div className="mt-2 text-[#111]">驳回原因：{application.reviewNote}</div>
                    ) : null}
                  </div>
                ) : null}

                {isApproved ? (
                  <div className="mt-6 rounded-2xl border border-[#e8f7ec] bg-[#f6fff8] p-5 text-sm leading-6 text-[#166534]">
                    已通过，可进入后台。
                  </div>
                ) : (
                  <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="商户名称" required>
                        <input
                          value={form.organizerName}
                          onChange={(e) => handleChange('organizerName', e.target.value)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                          placeholder="请输入商户名称"
                        />
                      </Field>
                      <Field label="主体类型" required>
                        <select
                          value={form.subjectType}
                          onChange={(e) => handleChange('subjectType', e.target.value as SubjectType)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                        >
                          <option value="personal">个人</option>
                          <option value="enterprise">企业</option>
                        </select>
                      </Field>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="联系人" required>
                        <input
                          value={form.contactName}
                          onChange={(e) => handleChange('contactName', e.target.value)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                          placeholder="请输入联系人姓名"
                        />
                      </Field>
                      <Field label="联系电话" required>
                        <input
                          value={form.contactPhone}
                          onChange={(e) => handleChange('contactPhone', e.target.value)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                          placeholder="请输入联系电话"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="联系邮箱">
                        <input
                          value={form.contactEmail}
                          onChange={(e) => handleChange('contactEmail', e.target.value)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                          placeholder="请输入联系邮箱"
                        />
                      </Field>
                      <Field label="营业执照号">
                        <input
                          value={form.licenseNo}
                          onChange={(e) => handleChange('licenseNo', e.target.value)}
                          disabled={!canEditForm}
                          className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                          placeholder="个人主体可选填"
                        />
                      </Field>
                    </div>

                    <Field label="经营范围">
                      <input
                        value={form.businessScope}
                        onChange={(e) => handleChange('businessScope', e.target.value)}
                        disabled={!canEditForm}
                        className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                        placeholder="请输入经营范围"
                      />
                    </Field>

                    <Field label="申请说明">
                      <textarea
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={!canEditForm}
                        rows={5}
                        className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#bbb] focus:border-[#ff1268] disabled:bg-[#fafafa] disabled:text-[#999]"
                        placeholder="请简要描述商户资质、主营业务和合作意向"
                      />
                    </Field>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={!canEditForm || saving}
                        className="inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-5 py-3 text-sm font-medium text-white shadow-sm shadow-[#ff1268]/20 transition-colors hover:bg-[#e60f5f] disabled:cursor-not-allowed disabled:bg-[#f4a0bb]"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {application ? '重新提交申请' : '提交申请'}
                      </button>
                      <span className="text-xs text-[#999]">
                        提交时不需要传入用户编号，系统会自动使用当前登录账号。
                      </span>
                    </div>
                  </form>
                )}

                {message ? (
                  <div className="mt-5 rounded-2xl border border-[#e8f7ec] bg-[#f6fff8] px-4 py-3 text-sm text-[#166534]">
                    {message}
                  </div>
                ) : null}
              </section>

              <aside className="space-y-6">
                <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#111]">状态说明</h3>
                  <div className="mt-4 space-y-3 text-sm text-[#666]">
                    <StateItem label="0 待审核" desc="申请已提交，等待平台审核。" color="#ff7a00" />
                    <StateItem label="1 已通过" desc="可以直接进入商户后台。" color="#16a34a" />
                    <StateItem label="2 已驳回" desc="查看驳回原因并修改后重新提交。" color="#ef4444" />
                    <StateItem label="3 已取消资格" desc="账号已降级为普通用户，可重新提交入驻申请。" color="#7c3aed" />
                  </div>
                </section>

                <section className="rounded-3xl border border-[#ffe3ee] bg-gradient-to-br from-white to-[#fff7fa] p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#111]">入驻提示</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[#666]">
                    <li>• 请确保联系人信息与资质材料一致。</li>
                    <li>• 个人主体与企业主体在审核材料上可能存在差异。</li>
                    <li>• 审核通过后可直接使用商户后台入口。</li>
                  </ul>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-1 text-sm font-medium text-[#111]">
        {label}
        {required ? <span className="text-[#ff1268]">*</span> : null}
      </div>
      {children}
    </label>
  )
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fafafa] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[#999]">
        <span className="text-[#ff1268]">{icon}</span>
        {title}
      </div>
      <div className="mt-2 text-sm text-[#111]">{value}</div>
    </div>
  )
}

function StateItem({ label, desc, color }: { label: string; desc: string; color: string }) {
  return (
    <div className="rounded-2xl bg-[#fafafa] p-4">
      <div className="font-medium" style={{ color }}>
        {label}
      </div>
      <div className="mt-1 leading-6 text-[#666]">{desc}</div>
    </div>
  )
}
