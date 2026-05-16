'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { login, sendSmsCode } from '@/lib/api'
import { setToken, setUser } from '@/lib/auth'
import { Mail, Lock, Phone, KeyRound, QrCode, ArrowRight } from 'lucide-react'

type LoginTab = 'password' | 'sms' | 'qrcode'

export function LoginForm() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<LoginTab>('password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [smsMobile, setSmsMobile] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const clearError = () => { if (errorMsg) setErrorMsg('') }

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!account.trim()) { setErrorMsg('请输入手机号或邮箱'); return }
    if (!password) { setErrorMsg('请输入登录密码'); return }

    setLoading(true)
    setErrorMsg('')
    try {
      const data = await login({ loginType: 'password', account: account.trim(), password })
      setToken(data.token)
      setUser({ userId: data.userId, phone: data.phone, nickname: data.nickname, role: data.role })
      if (data.role === 'admin' || data.role === 'organizer') {
        router.push('/console')
      } else {
        router.push('/')
      }
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
      setUser({ userId: data.userId, phone: data.phone, nickname: data.nickname, role: data.role })
      if (data.role === 'admin' || data.role === 'organizer') {
        router.push('/console')
      } else {
        router.push('/')
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!smsMobile.trim()) { setErrorMsg('请输入手机号'); return }
    setErrorMsg('')
    try {
      const code = await sendSmsCode(smsMobile.trim())
      setSmsSent(true)
      setErrorMsg('')
      alert(`验证码: ${code}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '发送验证码失败')
    }
  }

  return (
    <div className="w-full bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 border border-white/20">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200/60 mb-8 relative">
        <button
          onClick={() => { setActiveTab('password'); clearError() }}
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
        <button
          onClick={() => { setActiveTab('qrcode'); clearError() }}
          className={`pb-3 transition-all duration-300 ml-auto ${activeTab === 'qrcode' ? 'text-[#ff1268]' : 'text-gray-400 hover:text-gray-600'}`}
          title="扫码登录"
        >
          <QrCode className="w-5 h-5" />
          {activeTab === 'qrcode' && <div className="absolute bottom-[-1px] right-0 w-5 h-[3px] bg-[#ff1268] rounded-full" />}
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
                  onChange={(e) => { setSmsMobile(e.target.value); clearError() }}
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
                  className="px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-[#ff1268] font-medium rounded-xl transition-colors whitespace-nowrap text-sm"
                >
                  {smsSent ? '重新发送' : '获取验证码'}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 text-red-500 rounded-lg text-sm border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {errorMsg}
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

        {/* ========== 扫码登录 ========== */}
        {activeTab === 'qrcode' && (
          <div className="py-6 flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="w-[180px] h-[180px] bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6 p-2 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-[#ff1268]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <QrCode className="w-32 h-32 text-gray-800" />
              {/* Scan Line Animation */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#ff1268] shadow-[0_0_8px_#ff1268] animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-800 mb-2">打开万象APP扫码登录</h3>
            <p className="text-sm text-gray-500">点击"我的"右上角扫一扫</p>
          </div>
        )}

        {/* Links & SNS */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <a onClick={() => router.push('/register')} className="text-gray-500 hover:text-[#ff1268] cursor-pointer transition-colors font-medium">
            免费注册
          </a>
          <a onClick={() => router.push('/forgot-password')} className="text-gray-500 hover:text-[#ff1268] cursor-pointer transition-colors font-medium">
            忘记密码
          </a>
        </div>

        <div className="mt-8">
           <div className="flex items-center justify-center space-x-4 mb-6">
             <span className="h-[1px] bg-gray-100 flex-1"></span>
             <span className="text-xs text-gray-400 font-medium">其他登录方式</span>
             <span className="h-[1px] bg-gray-100 flex-1"></span>
           </div>
           <div className="flex justify-center gap-4">
             {[
               { name: '淘宝', icon: 'ri:taobao-fill', color: '#ff5000' },
               { name: '微信', icon: 'ri:wechat-fill', color: '#09bb07' },
               { name: 'QQ', icon: 'ri:qq-fill', color: '#12b7f5' },
               { name: '微博', icon: 'ri:weibo-fill', color: '#e6162d' },
               { name: '支付宝', icon: 'ri:alipay-fill', color: '#1677ff' }
             ].map((platform) => (
               <button
                 key={platform.name}
                 title={`${platform.name}登录`}
                 className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-110 hover:shadow-md transition-all active:scale-95"
                 style={{ backgroundColor: platform.color }}
               >
                 <img 
                   src={`https://api.iconify.design/${platform.icon}.svg?color=white`} 
                   alt={platform.name} 
                   className="w-5 h-5" 
                 />
               </button>
             ))}
           </div>
        </div>

      </div>
    </div>
  )
}
