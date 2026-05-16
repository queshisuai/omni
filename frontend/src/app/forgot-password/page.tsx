'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sendSmsCode } from '@/lib/api'
import { User, ShieldCheck } from 'lucide-react'
import { LoginFooter } from '@/components/LoginFooter'
import { LoginHeader } from '@/components/LoginHeader'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const clearError = () => { if (errorMsg) setErrorMsg('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account.trim()) { setErrorMsg('请输入手机号或邮箱'); return }

    setLoading(true)
    setErrorMsg('')
    try {
      const code = await sendSmsCode(account.trim())
      alert(`验证码: ${code}`)
      setErrorMsg('')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '发送验证码失败')
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
            <p className="text-sm text-gray-500 text-center mb-8">请输入需要找回密码的账号信息</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">登录名</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff1268] transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={account}
                    onChange={(e) => { setAccount(e.target.value); clearError() }}
                    placeholder="手机号或邮箱"
                    className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block pl-11 p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                  />
                </div>
              </div>

              {/* Security Scratch Card Mock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">安全验证</label>
                <div className="w-full h-[120px] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden relative group">
                  {/* Fake toolbar */}
                  <div className="h-8 bg-gray-100/80 px-3 flex items-center justify-between border-b border-gray-200 text-xs text-gray-500">
                    <span>请刮开图层</span>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  
                  {/* Fake Canvas */}
                  <div className="h-[88px] relative flex items-center justify-center gap-6 text-[#ff1268]/20">
                    <ShieldCheck className="w-12 h-12" />
                    <User className="w-12 h-12" />
                    {/* Scratch overlay */}
                    <div className="absolute inset-0 bg-[#e5e5e5] flex items-center justify-center cursor-pointer hover:bg-[#d4d4d4] transition-colors shadow-inner">
                      <span className="text-gray-500 font-medium tracking-widest pointer-events-none">刮开此区域</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-500 rounded-lg text-sm border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {errorMsg}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full text-white bg-gradient-to-r from-[#ff1268] to-[#ff4b8b] hover:from-[#e00958] hover:to-[#e6306c] focus:ring-4 focus:ring-[#ff1268]/30 font-medium rounded-xl text-[16px] px-5 py-3.5 text-center transition-all shadow-lg shadow-[#ff1268]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? '发送中...' : '确认找回'}
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
