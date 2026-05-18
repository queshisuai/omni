'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resetPassword, sendSmsCode } from '@/lib/api'
import { Lock, MessageSquareText, Phone, ShieldCheck } from 'lucide-react'
import { LoginFooter } from '@/components/LoginFooter'
import { LoginHeader } from '@/components/LoginHeader'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [resetDone, setResetDone] = useState(false)

  const clearError = () => { if (errorMsg) setErrorMsg('') }

  const handleSendCode = async () => {
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) { setErrorMsg('请输入手机号'); return }

    setSendingCode(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const code = await sendSmsCode(trimmedPhone)
      setSuccessMsg(`验证码已发送，Mock 验证码为 ${code}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resetDone || loading) { return }
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) { setErrorMsg('请输入手机号'); return }
    if (!smsCode.trim()) { setErrorMsg('请输入验证码'); return }
    if (newPassword.length < 6) { setErrorMsg('新密码长度不能少于6位'); return }
    if (newPassword !== confirmPassword) { setErrorMsg('两次密码输入不一致'); return }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      await resetPassword({ phone: trimmedPhone, smsCode: smsCode.trim(), newPassword, confirmPassword })
      setResetDone(true)
      setSuccessMsg('密码重置成功，即将跳转登录页')
      setTimeout(() => router.push('/login?message=password-reset'), 900)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '重置密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5]">
      <LoginHeader />
      
      <div 
        className="flex-1 relative flex items-center justify-center bg-[length:100%_100%] bg-center bg-no-repeat py-12"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className="absolute inset-0 bg-[#1E1346]/40" />

        <div className="relative w-full max-w-[1200px] mx-auto px-5 flex items-center justify-end z-10">
          <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-10 border border-white/20 animate-in fade-in slide-in-from-right-10 duration-700">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">找回密码</h2>
            <p className="text-sm text-gray-500 text-center mb-8">通过手机号验证码重置登录密码</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); clearError(); setSuccessMsg('') }}
                      placeholder="请输入注册手机号"
                      className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">短信验证码</label>
                  <div className="flex gap-3">
                    <div className="relative group flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MessageSquareText className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                      </div>
                      <input
                        type="text"
                        value={smsCode}
                        onChange={(e) => { setSmsCode(e.target.value); clearError(); setSuccessMsg('') }}
                        placeholder="验证码"
                        className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={sendingCode || resetDone}
                      className="w-[118px] rounded-xl border border-[#ff1268]/30 bg-[#ff1268]/5 text-[#ff1268] text-sm font-medium hover:bg-[#ff1268]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sendingCode ? '发送中...' : '获取验证码'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); clearError(); setSuccessMsg('') }}
                      placeholder="不少于6位"
                      className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); clearError(); setSuccessMsg('') }}
                      placeholder="请再次输入新密码"
                      className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-500 rounded-lg text-sm border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || resetDone}
                  className="mt-6 w-full text-white bg-gradient-to-r from-[#ff1268] to-[#ff4b8b] hover:from-[#e00958] hover:to-[#e6306c] focus:ring-4 focus:ring-[#ff1268]/30 font-medium rounded-xl text-[16px] px-5 py-3.5 text-center transition-all shadow-lg shadow-[#ff1268]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? '提交中...' : '重置密码'}
                </button>

                <div className="flex justify-between items-center text-sm mt-4 px-1">
                  <Link href="/register" className="text-gray-500 hover:text-[#ff1268] transition-colors">
                    免费注册
                  </Link>
                  <Link href="/login" className="text-gray-500 hover:text-[#ff1268] transition-colors">
                    返回登录
                  </Link>
                </div>

              </form>
          </div>
        </div>
      </div>

      <LoginFooter />
    </div>
  )
}
