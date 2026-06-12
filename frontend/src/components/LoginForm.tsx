'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { login, sendSmsCode } from '@/lib/api'
import { setToken, setUser } from '@/lib/auth'
import { getLoginRedirectForRole } from '@/lib/support-tools'
import { Mail, Lock, Phone, KeyRound, ArrowRight } from 'lucide-react'

type LoginTab = 'password' | 'sms'

interface LoginFormProps {
  successMessage?: string
}

export function LoginForm({ successMessage = '' }: LoginFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<LoginTab>('password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [smsMobile, setSmsMobile] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsSending, setSmsSending] = useState(false)
  const [smsInfoMsg, setSmsInfoMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const clearError = () => { if (errorMsg) setErrorMsg('') }
  const clearSmsInfo = () => { if (smsInfoMsg) setSmsInfoMsg('') }

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!account.trim()) { setErrorMsg('请输入手机号或邮箱'); return }
    if (!password) { setErrorMsg('请输入登录密码'); return }

    setLoading(true)
    setErrorMsg('')
    try {
      const data = await login({ loginType: 'password', account: account.trim(), password })
      setToken(data.token)
      const permissionCodes = data.permissionCodes || []
      setUser({ userId: data.userId, phone: data.phone, nickname: data.nickname, avatar: data.avatar || null, role: data.role, permissionCodes })
      router.push(getLoginRedirectForRole(data.role, permissionCodes))
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSmsLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!smsMobile.trim()) { setErrorMsg('请输入手机号'); return }
    if (!smsCode.trim()) { setErrorMsg('请输入短信验证码'); return }

    setLoading(true)
    setErrorMsg('')
    try {
      const data = await login({ loginType: 'sms', account: smsMobile.trim(), smsCode: smsCode.trim() })
      setToken(data.token)
      const permissionCodes = data.permissionCodes || []
      setUser({ userId: data.userId, phone: data.phone, nickname: data.nickname, avatar: data.avatar || null, role: data.role, permissionCodes })
      router.push(getLoginRedirectForRole(data.role, permissionCodes))
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!smsMobile.trim()) { setErrorMsg('请输入手机号'); return }
    if (smsSending) return
    setSmsSending(true)
    setErrorMsg('')
    setSmsInfoMsg('')
    try {
      await sendSmsCode(smsMobile.trim())
      setSmsSent(true)
      setSmsInfoMsg('验证码已发送，请按短信提示输入。')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setSmsSending(false)
    }
  }

  return (
    <div className="w-full bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 border border-white/20">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200/60 mb-8 relative">
        <button
          onClick={() => { setActiveTab('password'); clearError(); clearSmsInfo() }}
          className={`pb-3 text-[16px] font-semibold transition-all duration-300 relative ${activeTab === 'password' ? 'text-[#ff1268]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          密码登录
          {activeTab === 'password' && <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#ff1268] rounded-full" />}
        </button>
        <button
          onClick={() => { setActiveTab('sms'); clearError() }}
          className={`pb-3 text-[16px] font-semibold transition-all duration-300 relative ${activeTab === 'sms' ? 'text-[#ff1268]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          验证码登录
          {activeTab === 'sms' && <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#ff1268] rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="w-full">
        {/* ========== 密码登录 ========== */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                </div>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => { setAccount(e.target.value); clearError() }}
                  placeholder="请输入手机号或邮箱"
                  className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  placeholder="请输入登录密码"
                  className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 text-red-500 rounded-lg text-sm border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {errorMsg}
              </div>
            )}

            {successMessage && (
              <div className="mt-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full text-white bg-gradient-to-r from-[#ff1268] to-[#ff4b8b] hover:from-[#e00958] hover:to-[#e6306c] focus:ring-4 focus:ring-[#ff1268]/30 font-medium rounded-xl text-[16px] px-5 py-3.5 text-center transition-all shadow-lg shadow-[#ff1268]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? '登录中...' : '登录'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* ========== 短信登录 ========== */}
        {activeTab === 'sms' && (
          <form onSubmit={handleSmsLogin} className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                </div>
                <input
                  type="text" value={smsMobile}
                  onChange={(e) => { setSmsMobile(e.target.value); clearError(); clearSmsInfo() }}
                  placeholder="请输入手机号"
                  className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                />
              </div>

              <div className="relative group flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                  </div>
                  <input
                    type="text" value={smsCode}
                    onChange={(e) => { setSmsCode(e.target.value); clearError() }}
                    placeholder="请输入验证码"
                    className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={smsSending || loading}
                  className="px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-[#ff1268] font-medium rounded-xl transition-colors whitespace-nowrap text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {smsSending ? '发送中...' : smsSent ? '重新获取' : '获取验证码'}
                </button>
              </div>
              <p className="text-xs leading-5 text-gray-500">验证码发送后请按短信提示输入，提交时会由后端校验。</p>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 text-red-500 rounded-lg text-sm border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {errorMsg}
              </div>
            )}

            {smsInfoMsg && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-600 rounded-lg text-sm border border-blue-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {smsInfoMsg}
              </div>
            )}

            {successMessage && (
              <div className="mt-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {successMessage}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="mt-8 w-full text-white bg-gradient-to-r from-[#ff1268] to-[#ff4b8b] hover:from-[#e00958] hover:to-[#e6306c] focus:ring-4 focus:ring-[#ff1268]/30 font-medium rounded-xl text-[16px] px-5 py-3.5 text-center transition-all shadow-lg shadow-[#ff1268]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? '登录中...' : '登录'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Links */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <a onClick={() => router.push('/register')} className="text-gray-500 hover:text-[#ff1268] cursor-pointer transition-colors font-medium">
            免费注册
          </a>
          <a onClick={() => router.push('/forgot-password')} className="text-gray-500 hover:text-[#ff1268] cursor-pointer transition-colors font-medium">
            忘记密码
          </a>
        </div>
      </div>
    </div>
  )
}
