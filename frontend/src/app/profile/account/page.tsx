'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, LockKeyhole, User, Mail, MessageSquare } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { LocalFileUpload } from '@/components/LocalFileUpload'
import { changePassword, getUserInfo, sendSmsCode, updateProfile, uploadUserAvatar } from '@/lib/api'
import { isAuthenticated, updateStoredUser } from '@/lib/auth'
import type { UserInfo } from '@/types/api'

type FormState = {
  nickname: string
  email: string
  avatar: string
}

export default function ProfileAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [form, setForm] = useState<FormState>({ nickname: '', email: '', avatar: '' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [sendingPasswordCode, setSendingPasswordCode] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', smsCode: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/profile/account')
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
        if (active) setError(err instanceof Error ? err.message : '加载账户信息失败')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

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

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMessage('')
    try {
      await changePassword(passwordForm)
      setPasswordMessage('密码修改成功')
      setPasswordForm({ oldPassword: '', smsCode: '', newPassword: '', confirmPassword: '' })
    } catch (err: unknown) {
      setPasswordMessage(err instanceof Error ? err.message : '修改密码失败')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSendPasswordCode = async () => {
    if (!user?.phone) {
      setPasswordMessage('当前账号缺少手机号')
      return
    }
    setSendingPasswordCode(true)
    setPasswordMessage('')
    try {
      const code = await sendSmsCode(user.phone)
      setPasswordMessage(`演示环境不会发送真实短信，Mock 验证码为 ${code || '666666'}，修改时仍会由后端校验。`)
    } catch (err: unknown) {
      setPasswordMessage(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setSendingPasswordCode(false)
    }
  }

  return (
    <>
      <Header />
      <main className="bg-[#f7f8fa] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-[#111]">账号设置</h1>
            <p className="mt-2 text-sm text-[#666]">编辑个人资料并修改密码，修改后不会强制退出登录。</p>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-[#ececec] bg-white shadow-sm">
              <div className="flex items-center gap-3 text-[#666]">
                <Loader2 className="h-5 w-5 animate-spin text-[#ff1268]" />
                正在加载账户信息...
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
          ) : (
            <div className="space-y-6">
              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#ff1268]">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#111]">个人资料</h2>
                    <p className="text-sm text-[#666]">基础资料会同步到当前账户。</p>
                  </div>
                </div>

                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProfileSubmit}>
                  <Field
                    icon={<User className="h-4 w-4" />}
                    label="昵称"
                    value={form.nickname}
                    onChange={(value) => setForm((prev) => ({ ...prev, nickname: value }))}
                    placeholder="请输入昵称"
                  />
                  <Field
                    icon={<Mail className="h-4 w-4" />}
                    label="邮箱"
                    value={form.email}
                    onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                    placeholder="请输入邮箱"
                    type="email"
                  />
                  <div className="sm:col-span-2">
                    <LocalFileUpload
                      label="头像"
                      value={form.avatar}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      uploading={uploadingAvatar}
                      onUpload={handleAvatarUpload}
                      onChange={(value) => setForm((prev) => ({ ...prev, avatar: value }))}
                      hint="支持 JPG、PNG、WebP、GIF，上传后会自动写入头像地址。"
                    />
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-3 border-t border-[#f0f0f0] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#666]">{profileMessage || `当前账号：${user?.phone || ''}`}</p>
                    <button
                      type="submit"
                      disabled={savingProfile || uploadingAvatar}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff1268] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e60f5f] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      保存资料
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-3xl border border-[#ececec] bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#ff1268]">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#111]">修改密码</h2>
                    <p className="text-sm text-[#666]">提交后即时生效，不会强制登出；演示环境固定验证码 666666，由后端真实校验。</p>
                  </div>
                </div>

                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePasswordSubmit}>
                  <PasswordField
                    label="旧密码"
                    value={passwordForm.oldPassword}
                    onChange={(value) => setPasswordForm((prev) => ({ ...prev, oldPassword: value }))}
                  />
                  <SmsCodeField
                    value={passwordForm.smsCode}
                    onChange={(value) => setPasswordForm((prev) => ({ ...prev, smsCode: value }))}
                    onSend={handleSendPasswordCode}
                    sending={sendingPasswordCode}
                  />
                  <PasswordField
                    label="新密码"
                    value={passwordForm.newPassword}
                    onChange={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
                  />
                  <PasswordField
                    label="确认密码"
                    value={passwordForm.confirmPassword}
                    onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
                  />

                  <div className="sm:col-span-2 flex flex-col gap-3 border-t border-[#f0f0f0] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#666]">{passwordMessage || '密码长度建议不少于 6 位；验证码使用演示环境固定值 666666。'}</p>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ff1268] px-5 py-2.5 text-sm font-medium text-[#ff1268] transition-colors hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                      修改密码
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[#333]">
        <span className="text-[#ff1268]">{icon}</span>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#aaa] focus:border-[#ff1268] focus:bg-white"
      />
    </label>
  )
}

function SmsCodeField({
  value,
  onChange,
  onSend,
  sending,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[#333]">
        <MessageSquare className="h-4 w-4 text-[#ff1268]" />
        短信验证码
      </span>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="演示验证码 666666"
          className="min-w-0 flex-1 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#aaa] focus:border-[#ff1268] focus:bg-white"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="shrink-0 rounded-2xl border border-[#ff1268] px-4 py-3 text-sm font-medium text-[#ff1268] transition-colors hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sending ? '发送中' : '发送验证码'}
        </button>
      </div>
    </label>
  )
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#333]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm text-[#111] outline-none transition-colors placeholder:text-[#aaa] focus:border-[#ff1268] focus:bg-white"
      />
    </label>
  )
}
