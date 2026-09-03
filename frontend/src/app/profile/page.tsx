'use client'

import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Save,
  ShieldCheck,
  ShieldHalf,
  Smartphone,
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { SafeImage } from '@/components/SafeImage'
import {
  changePassword,
  changePhone,
  getUserInfo,
  sendSmsCode,
  updateProfile,
  uploadUserAvatar,
  verifyCurrentPhone,
  verifyPasswordIdentity,
} from '@/lib/api'
import { isAuthenticated, removeToken, updateStoredUser } from '@/lib/auth'
import { canEnterConsole, getConsoleRoleLabel } from '@/lib/console-auth'
import type { UserInfo } from '@/types/api'

type FormState = {
  nickname: string
  email: string
  avatar: string
}

type PasswordFormState = {
  oldPassword: string
  smsCode: string
  newPassword: string
  confirmPassword: string
}

type PhoneFormState = {
  currentSmsCode: string
  newPhone: string
  newSmsCode: string
}

const initialPasswordForm: PasswordFormState = { oldPassword: '', smsCode: '', newPassword: '', confirmPassword: '' }
const initialPhoneForm: PhoneFormState = { currentSmsCode: '', newPhone: '', newSmsCode: '' }
const phonePattern = /^1[3-9]\d{9}$/

function formatTime(value: string | null | undefined) {
  if (!value) return '未设置'
  return value.replace('T', ' ').slice(0, 19)
}

function formatMaskedPhone(phone: string | null | undefined) {
  const value = phone?.trim()
  if (!value) return '未绑定'
  if (value.length < 7) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function authLabel(status: number) {
  if (status === 1) return { text: '已启用', color: '#52C41A', bg: '#F6FFED' }
  if (status === 0) return { text: '未启用', color: '#FAAD14', bg: '#FFFBE6' }
  return { text: '已禁用', color: '#FF4D4F', bg: '#FFF1F0' }
}

function isAuthExpiredMessage(message: string) {
  return message === '未认证' || message.includes('登录状态已失效') || message.includes('请重新登录')
}

export default function ProfilePage() {
  const router = useRouter()
  const countdownTimers = useRef<number[]>([])
  const toastTimer = useRef<number | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [form, setForm] = useState<FormState>({ nickname: '', email: '', avatar: '' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1)
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm)
  const [phoneForm, setPhoneForm] = useState<PhoneFormState>(initialPhoneForm)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [phoneMessage, setPhoneMessage] = useState('')
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [sendingPasswordCode, setSendingPasswordCode] = useState(false)
  const [sendingCurrentPhoneCode, setSendingCurrentPhoneCode] = useState(false)
  const [sendingNewPhoneCode, setSendingNewPhoneCode] = useState(false)
  const [passwordCodeCountdown, setPasswordCodeCountdown] = useState(0)
  const [currentPhoneCodeCountdown, setCurrentPhoneCodeCountdown] = useState(0)
  const [newPhoneCodeCountdown, setNewPhoneCodeCountdown] = useState(0)
  const [toastMessage, setToastMessage] = useState('')

  const clearCountdownTimers = () => {
    countdownTimers.current.forEach((timer) => window.clearInterval(timer))
    countdownTimers.current = []
  }

  const clearSecurityCountdowns = () => {
    clearCountdownTimers()
    setPasswordCodeCountdown(0)
    setCurrentPhoneCodeCountdown(0)
    setNewPhoneCodeCountdown(0)
  }

  const resetSecurityModals = () => {
    clearSecurityCountdowns()
    setPasswordModalOpen(false)
    setPhoneModalOpen(false)
    setPasswordStep(1)
    setPhoneStep(1)
    setPasswordForm(initialPasswordForm)
    setPhoneForm(initialPhoneForm)
    setPasswordMessage('')
    setPhoneMessage('')
    setVerifyingPassword(false)
    setSavingPassword(false)
    setVerifyingPhone(false)
    setSavingPhone(false)
    setSendingPasswordCode(false)
    setSendingCurrentPhoneCode(false)
    setSendingNewPhoneCode(false)
  }

  const startCountdown = (setter: Dispatch<SetStateAction<number>>) => {
    setter(60)
    const timer = window.setInterval(() => {
      setter((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          countdownTimers.current = countdownTimers.current.filter((item) => item !== timer)
          return 0
        }
        return value - 1
      })
    }, 1000)
    countdownTimers.current.push(timer)
  }

  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToastMessage(message)
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 2600)
  }

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
        if (!active) return
        setUser(data)
        setForm({
          nickname: data.nickname || '',
          email: data.email || '',
          avatar: data.avatar || '',
        })
      } catch (err: unknown) {
        if (!active) return
        const message = err instanceof Error ? err.message : '加载个人信息失败'
        if (isAuthExpiredMessage(message)) {
          removeToken()
          setError('登录状态已失效，请重新登录')
          router.replace('/login?ru=/profile')
          return
        }
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    return () => {
      clearCountdownTimers()
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const handleProfileSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')
    try {
      const next = await updateProfile({
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        avatar: form.avatar.trim(),
      })
      setUser(next)
      setForm({
        nickname: next.nickname || '',
        email: next.email || '',
        avatar: next.avatar || '',
      })
      updateStoredUser({ nickname: next.nickname || null, avatar: next.avatar || null })
      setProfileMessage('个人资料已更新')
    } catch (err: unknown) {
      setProfileMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const next = await uploadUserAvatar(file)
      const avatar = next.avatar || ''
      if (!avatar) throw new Error('上传成功但未返回头像地址')

      setUser(next)
      setForm((prev) => ({ ...prev, avatar }))
      updateStoredUser({ nickname: next.nickname || null, avatar })
      return avatar
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileMessage('头像仅支持 JPG、PNG、WebP 格式')
      return
    }

    try {
      await handleAvatarUpload(file)
      setProfileMessage('头像已更新')
    } catch (err: unknown) {
      setProfileMessage(err instanceof Error ? err.message : '头像上传失败')
    }
  }

  const sendCodeToPhone = async (
    phone: string | null | undefined,
    setSending: Dispatch<SetStateAction<boolean>>,
    countdownSetter: Dispatch<SetStateAction<number>>,
    setMessage: Dispatch<SetStateAction<string>>,
  ) => {
    const targetPhone = phone?.trim()
    if (!targetPhone) {
      setMessage('当前账号缺少手机号')
      return
    }
    setSending(true)
    setMessage('')
    try {
      await sendSmsCode(targetPhone)
      startCountdown(countdownSetter)
      setMessage('验证码已发送，请按短信提示输入。')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setSending(false)
    }
  }

  const handleSendPasswordCode = () => sendCodeToPhone(user?.phone, setSendingPasswordCode, setPasswordCodeCountdown, setPasswordMessage)

  const handleSendCurrentPhoneCode = () => sendCodeToPhone(user?.phone, setSendingCurrentPhoneCode, setCurrentPhoneCodeCountdown, setPhoneMessage)

  const handleSendNewPhoneCode = () => {
    const newPhone = phoneForm.newPhone.trim()
    if (!phonePattern.test(newPhone)) {
      setPhoneMessage('请输入正确的 11 位新手机号')
      return
    }
    sendCodeToPhone(newPhone, setSendingNewPhoneCode, setNewPhoneCodeCountdown, setPhoneMessage)
  }

  const handleVerifyPasswordIdentity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setVerifyingPassword(true)
    setPasswordMessage('')
    try {
      await verifyPasswordIdentity({ oldPassword: passwordForm.oldPassword, smsCode: passwordForm.smsCode })
      setPasswordStep(2)
      setPasswordMessage('身份验证已通过，请设置新密码。')
    } catch (err: unknown) {
      setPasswordMessage(err instanceof Error ? err.message : '身份验证失败')
    } finally {
      setVerifyingPassword(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()
    if (newPassword.length < 6) {
      setPasswordMessage('新密码长度不能少于6位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('两次密码输入不一致')
      return
    }

    setSavingPassword(true)
    setPasswordMessage('')
    try {
      await changePassword({
        oldPassword: passwordForm.oldPassword,
        smsCode: passwordForm.smsCode,
        newPassword,
        confirmPassword,
      })
      resetSecurityModals()
      showToast('密码修改成功')
    } catch (err: unknown) {
      setPasswordMessage(err instanceof Error ? err.message : '修改密码失败')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleVerifyCurrentPhone = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setVerifyingPhone(true)
    setPhoneMessage('')
    try {
      await verifyCurrentPhone({ smsCode: phoneForm.currentSmsCode })
      setPhoneStep(2)
      setPhoneMessage('原手机已验证，请绑定新手机。')
    } catch (err: unknown) {
      setPhoneMessage(err instanceof Error ? err.message : '原手机验证失败')
    } finally {
      setVerifyingPhone(false)
    }
  }

  const handleChangePhoneSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newPhone = phoneForm.newPhone.trim()
    if (!phonePattern.test(newPhone)) {
      setPhoneMessage('请输入正确的 11 位新手机号')
      return
    }

    setSavingPhone(true)
    setPhoneMessage('')
    try {
      const next = await changePhone({
        currentSmsCode: phoneForm.currentSmsCode,
        newPhone,
        newSmsCode: phoneForm.newSmsCode,
      })
      setUser(next)
      setForm({
        nickname: next.nickname || '',
        email: next.email || '',
        avatar: next.avatar || '',
      })
      updateStoredUser({ phone: next.phone, nickname: next.nickname || null, avatar: next.avatar || null })
      resetSecurityModals()
      showToast('安全手机号已更新')
    } catch (err: unknown) {
      setPhoneMessage(err instanceof Error ? err.message : '更换手机号失败')
    } finally {
      setSavingPhone(false)
    }
  }

  const openPasswordModal = () => {
    resetSecurityModals()
    setPasswordModalOpen(true)
  }

  const openPhoneModal = () => {
    resetSecurityModals()
    setPhoneModalOpen(true)
  }

  const authState = user ? authLabel(user.status) : null
  const roleLabel = user ? getConsoleRoleLabel(user.role, user.permissionCodes || []) : '未设置'
  const hasConsoleAccess = user ? canEnterConsole(user.role, user.permissionCodes || []) : false
  const maskedPhone = formatMaskedPhone(user?.phone)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1120px]">
          <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] font-bold leading-tight text-[#111]">个人中心</h1>
              <p className="mt-2 text-sm leading-6 text-[#666]">管理个人基础资料、账户安全及系统快捷入口</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <QuickActionButton icon={<Ticket className="h-4 w-4" />} label="订单管理" onClick={() => router.push('/orders')} />
              <QuickActionButton icon={<Clock3 className="h-4 w-4" />} label="我的候补" onClick={() => router.push('/waitlist')} />
              <QuickActionButton icon={<Users className="h-4 w-4" />} label="实名观演人" onClick={() => router.push('/profile/attendees')} />
              <QuickActionButton icon={<Bell className="h-4 w-4" />} label="通知偏好" onClick={() => router.push('/notifications/settings')} />
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#ECECEC] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 text-[#666]">
                <Loader2 className="h-5 w-5 animate-spin text-[#E6005C]" />
                正在加载个人信息…
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#FFD9E6] bg-white p-6 text-center shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <p className="text-sm text-[#FF4D4F]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-[#E6005C] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#D10053]"
              >
                重新加载
              </button>
            </div>
          ) : user ? (
            <div className="flex flex-col gap-6">
              <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                <div className="border-b border-[#F1F2F4] px-5 py-5 sm:px-8 sm:py-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#111]">个人设置中心</h2>
                      <p className="mt-1 text-[13px] leading-5 text-[#777]">集中管理头像、基础资料与账户安全凭证。</p>
                    </div>
                    <div className="hidden rounded-full bg-[#FFF0F5] px-3 py-1.5 text-xs font-semibold text-[#E6005C] sm:block">
                      资料与安全
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="w-20 shrink-0">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="group relative h-20 w-20 overflow-hidden rounded-2xl bg-[#FFF0F5] shadow-inner transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                          aria-label="更换头像"
                        >
                          {form.avatar ? (
                            <SafeImage src={form.avatar} alt={user.nickname || user.phone || '用户头像'} className="h-full w-full object-cover" />
                          ) : (
                            <User className="mx-auto h-full w-9 text-[#E6005C]" />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                            {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                          </span>
                        </button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="text-[#E6005C] transition-colors hover:text-[#E00D65] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            更换头像
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, avatar: '' }))
                              setProfileMessage('头像已清除，保存后生效')
                            }}
                            disabled={!form.avatar || savingProfile || uploadingAvatar}
                            className="text-[#999] transition-colors hover:text-[#E6005C] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            清除
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="truncate text-[26px] font-bold leading-tight text-[#111]">{user.nickname || '未设置昵称'}</h2>
                          {authState && (
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ color: authState.color, backgroundColor: authState.bg }}
                            >
                              {authState.text}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-6 text-[#777]">
                          <span>当前账号 / 手机：{user.phone || '未绑定'}</span>
                          <span>注册时间：{formatTime(user.createTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#FFD6E4] bg-[#FFF0F5] px-4 py-2 text-sm font-semibold text-[#E6005C]">
                      <ShieldCheck className="h-4 w-4" />
                      {roleLabel}
                    </div>
                  </div>
                </div>

                <div className="grid gap-7 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-2">
                  <form className="min-w-0" onSubmit={handleProfileSubmit}>
                    <div className="mb-5 flex items-start gap-3">
                      <span className="mt-1 h-8 w-1.5 rounded-full bg-[#FF1475]" />
                      <div>
                        <h3 className="text-[18px] font-bold text-[#111]">基础资料</h3>
                        <p className="mt-1 text-sm text-[#777]">修改后即时同步</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <Field
                        icon={<User className="h-4 w-4" />}
                        label="用户昵称"
                        value={form.nickname}
                        onChange={(value) => setForm((prev) => ({ ...prev, nickname: value }))}
                        placeholder="请输入昵称"
                      />
                      <Field
                        icon={<Mail className="h-4 w-4" />}
                        label="电子邮箱"
                        value={form.email}
                        onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                        placeholder="请输入电子邮箱"
                        type="email"
                      />
                    </div>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-h-5 text-[13px] text-[#777]">{profileMessage || `当前绑定账号：${user.phone || '未绑定'}`}</p>
                      <button
                        type="submit"
                        disabled={savingProfile || uploadingAvatar}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E6005C] px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#E6005C]/20 transition-colors hover:bg-[#E00D65] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        保存资料修改
                      </button>
                    </div>
                  </form>

                  <section className="min-w-0">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-8 w-1.5 rounded-full bg-[#FF1475]" />
                        <div>
                          <h3 className="text-[18px] font-bold text-[#111]">安全与认证</h3>
                          <p className="mt-1 text-sm text-[#777]">管理登录密码与敏感操作的安全凭证。</p>
                        </div>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-full bg-[#E8F8EE] px-3 py-1 text-xs font-semibold text-[#28C76F]">
                        安全防护等级：高
                      </span>
                    </div>
                    <div className="space-y-3">
                      <SecurityActionItem
                        icon={<LockKeyhole className="h-5 w-5" />}
                        title="登录密码"
                        description="定期更换密码有助于保护账号安全"
                        actionLabel="修改密码"
                        onClick={openPasswordModal}
                      />
                      <SecurityActionItem
                        icon={<Smartphone className="h-5 w-5" />}
                        title="安全手机"
                        description={`已绑定：${maskedPhone}（用于验证码校验）`}
                        actionLabel="更换手机"
                        onClick={openPhoneModal}
                      />
                    </div>
                    <p className="mt-4 text-[13px] leading-5 text-[#777]">最近安全操作：密码与手机变更需短信验证</p>
                  </section>
                </div>
              </section>

              <section className="flex flex-col gap-4 rounded-2xl border border-[#FFD6E4] bg-[#FFF0F5] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:flex-row sm:items-start sm:p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#E6005C] shadow-sm">
                  <ShieldHalf className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#111]">账户提示</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#666]">
                    为了您的账户安全，请不要随意将账号密码透露给他人。{hasConsoleAccess ? '当前账号具备后台权限，可从顶部菜单进入对应管理后台。' : '如需申请成为主办方，请联系客服获取权限。'}
                  </p>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>

      {passwordModalOpen && (
        <SecurityStepModal title="修改密码" onClose={resetSecurityModals}>
          <StepIndicator firstLabel={passwordStep === 1 ? '1. 身份验证' : '1. 身份已验证'} secondLabel="2. 设置新密码" activeStep={passwordStep} />
          {passwordStep === 1 ? (
            <form className="mt-6 space-y-4" onSubmit={handleVerifyPasswordIdentity}>
              <p className="rounded-2xl border border-[#FFD1E0] bg-[#FFF4F8] px-4 py-3 text-sm leading-6 text-[#666]">
                验证码将发送至当前绑定手机号 {maskedPhone}
              </p>
              <PasswordField
                label="旧密码"
                value={passwordForm.oldPassword}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, oldPassword: value }))}
              />
              <CodeField
                label="短信验证码"
                value={passwordForm.smsCode}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, smsCode: value }))}
                onSend={handleSendPasswordCode}
                sending={sendingPasswordCode}
                countdown={passwordCodeCountdown}
                buttonLabel="发送验证码"
              />
              <MessageLine message={passwordMessage} />
              <div className="flex justify-end gap-3 pt-2">
                <OutlineButton type="button" onClick={resetSecurityModals}>取消</OutlineButton>
                <PrimaryButton type="submit" loading={verifyingPassword}>下一步：验证身份</PrimaryButton>
              </div>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
              <PasswordField
                label="新密码"
                value={passwordForm.newPassword}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
                placeholder="不少于6位"
              />
              <PasswordField
                label="确认新密码"
                value={passwordForm.confirmPassword}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
              />
              <MessageLine message={passwordMessage || '密码长度建议不少于6位'} />
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <OutlineButton type="button" onClick={() => setPasswordStep(1)}>上一步</OutlineButton>
                <div className="flex justify-end gap-3">
                  <OutlineButton type="button" onClick={resetSecurityModals}>取消</OutlineButton>
                  <PrimaryButton type="submit" loading={savingPassword}>完成修改</PrimaryButton>
                </div>
              </div>
            </form>
          )}
        </SecurityStepModal>
      )}

      {phoneModalOpen && (
        <SecurityStepModal title="更换手机号" onClose={resetSecurityModals}>
          <StepIndicator firstLabel={phoneStep === 1 ? '1. 验证原手机' : '1. 原手机已验证'} secondLabel="2. 绑定新手机" activeStep={phoneStep} />
          {phoneStep === 1 ? (
            <form className="mt-6 space-y-4" onSubmit={handleVerifyCurrentPhone}>
              <p className="rounded-2xl border border-[#FFD1E0] bg-[#FFF4F8] px-4 py-3 text-sm leading-6 text-[#666]">
                为了保障账户安全，更换前需验证当前绑定的手机号 {maskedPhone}
              </p>
              <CodeField
                label="当前手机验证码"
                value={phoneForm.currentSmsCode}
                onChange={(value) => setPhoneForm((prev) => ({ ...prev, currentSmsCode: value }))}
                onSend={handleSendCurrentPhoneCode}
                sending={sendingCurrentPhoneCode}
                countdown={currentPhoneCodeCountdown}
                buttonLabel="获取验证码"
              />
              <MessageLine message={phoneMessage} />
              <div className="flex justify-end gap-3 pt-2">
                <OutlineButton type="button" onClick={resetSecurityModals}>取消</OutlineButton>
                <PrimaryButton type="submit" loading={verifyingPhone}>下一步：绑定新手机</PrimaryButton>
              </div>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleChangePhoneSubmit}>
              <Field
                icon={<Smartphone className="h-4 w-4" />}
                label="新手机号码"
                value={phoneForm.newPhone}
                onChange={(value) => setPhoneForm((prev) => ({ ...prev, newPhone: value }))}
                placeholder="请输入 11 位手机号"
                type="tel"
              />
              <CodeField
                label="新手机验证码"
                value={phoneForm.newSmsCode}
                onChange={(value) => setPhoneForm((prev) => ({ ...prev, newSmsCode: value }))}
                onSend={handleSendNewPhoneCode}
                sending={sendingNewPhoneCode}
                countdown={newPhoneCodeCountdown}
                buttonLabel="发送验证码"
              />
              <MessageLine message={phoneMessage} />
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <OutlineButton type="button" onClick={() => setPhoneStep(1)}>上一步</OutlineButton>
                <div className="flex justify-end gap-3">
                  <OutlineButton type="button" onClick={resetSecurityModals}>取消</OutlineButton>
                  <PrimaryButton type="submit" loading={savingPhone}>确认绑定</PrimaryButton>
                </div>
              </div>
            </form>
          )}
        </SecurityStepModal>
      )}

      {toastMessage && <Toast message={toastMessage} />}
      <Footer />
    </>
  )
}

function QuickActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#FFD1E0] bg-white px-4 py-2 text-sm font-semibold text-[#E6005C] shadow-sm transition-colors hover:border-[#E6005C] hover:bg-[#FFF4F8]"
    >
      {icon}
      {label}
    </button>
  )
}

function SecurityActionItem({ icon, title, description, actionLabel, onClick }: { icon: ReactNode; title: string; description: string; actionLabel: string; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#E6005C] shadow-sm">
          {icon}
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#111]">{title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#666]">{description}</p>
        </div>
      </div>
      <OutlineButton type="button" onClick={onClick}>{actionLabel}</OutlineButton>
    </div>
  )
}

function SecurityStepModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-[#F2F2F2] px-6 py-5">
          <h2 className="text-[20px] font-bold text-[#111]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#999] transition-colors hover:bg-[#FFF4F8] hover:text-[#E6005C]" aria-label="关闭弹窗">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

function StepIndicator({ firstLabel, secondLabel, activeStep }: { firstLabel: string; secondLabel: string; activeStep: 1 | 2 }) {
  const firstDone = activeStep === 2
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${firstDone ? 'bg-[#F6FFED] text-[#52C41A]' : 'bg-[#FFF0F5] text-[#E6005C]'}`}>
        {firstDone ? <CheckCircle2 className="h-4 w-4" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E6005C] text-[10px] text-white">1</span>}
        {firstLabel}
      </div>
      <div className="h-px w-8 bg-[#FFD1E0]" />
      <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${activeStep === 2 ? 'bg-[#FFF0F5] text-[#E6005C]' : 'bg-[#F7F8FA] text-[#999]'}`}>
        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${activeStep === 2 ? 'bg-[#E6005C] text-white' : 'bg-[#E5E7EB] text-[#777]'}`}>2</span>
        {secondLabel}
      </div>
    </div>
  )
}

function Field({ icon, label, value, onChange, placeholder, type = 'text' }: { icon: ReactNode; label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#333]">
        <span className="text-[#E6005C]">{icon}</span>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#AAA] focus:border-[#E6005C] focus:bg-white"
      />
    </label>
  )
}

function CodeField({ label, value, onChange, onSend, sending, countdown, buttonLabel }: { label: string; value: string; onChange: (value: string) => void; onSend: () => void; sending: boolean; countdown: number; buttonLabel: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#333]">
        <MessageSquare className="h-4 w-4 text-[#E6005C]" />
        {label}
      </span>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入验证码"
          className="min-w-0 flex-1 rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#AAA] focus:border-[#E6005C] focus:bg-white"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending || countdown > 0}
          className="shrink-0 rounded-2xl border border-[#E6005C] bg-white px-4 py-3 text-sm font-semibold text-[#E6005C] transition-colors hover:bg-[#FFF4F8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? '发送中' : countdown > 0 ? `${countdown}s` : buttonLabel}
        </button>
      </div>
    </label>
  )
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#333]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#AAA] focus:border-[#E6005C] focus:bg-white"
      />
    </label>
  )
}

function MessageLine({ message }: { message: string }) {
  if (!message) return null
  return <p className="text-[13px] leading-5 text-[#E6005C]">{message}</p>
}

function OutlineButton({ children, type, onClick }: { children: ReactNode; type: 'button' | 'submit'; onClick?: () => void }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-[#E6005C] bg-white px-5 py-2.5 text-sm font-semibold text-[#E6005C] transition-colors hover:bg-[#FFF4F8]"
    >
      {children}
    </button>
  )
}

function PrimaryButton({ children, type, loading }: { children: ReactNode; type: 'button' | 'submit'; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E6005C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#E6005C]/20 transition-colors hover:bg-[#D10053] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed right-5 top-24 z-[1100] rounded-2xl border border-[#FFD1E0] bg-white px-5 py-3 text-sm font-semibold text-[#E6005C] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
      {message}
    </div>
  )
}
