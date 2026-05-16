'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { syncAlipayPayment } from '@/lib/api'
import type { PaymentStatusResponse } from '@/types/api'

type PageState = 'loading' | 'success' | 'pending' | 'error'

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<PaymentResultFallback />}>
      <PaymentResultContent />
    </Suspense>
  )
}

function PaymentResultFallback() {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] bg-[#f7f8fa] px-5 py-12">
        <div className="max-w-[720px] mx-auto bg-white border border-[#e9e9e9] rounded-2xl shadow-sm px-6 py-12 text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-[#fff7e6]">
            <Clock className="w-11 h-11 text-[#faad14]" />
          </div>
          <h1 className="text-[26px] font-medium text-[#111] mb-3">正在确认支付结果</h1>
          <p className="text-[14px] text-[#666] leading-6 mb-8">正在确认支付结果...</p>
        </div>
      </main>
      <Footer />
    </>
  )
}

function PaymentResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>('loading')
  const [message, setMessage] = useState('正在确认支付结果...')
  const [result, setResult] = useState<PaymentStatusResponse | null>(null)
  const [redirectSeconds, setRedirectSeconds] = useState(3)

  useEffect(() => {
    const orderIdText = searchParams.get('orderId')
    const orderId = orderIdText ? Number(orderIdText) : NaN

    if (!Number.isInteger(orderId) || orderId <= 0) {
      setState('error')
      setMessage('缺少有效订单号，无法确认支付结果')
      return
    }

    ;(async () => {
      setState('loading')
      setMessage('正在确认支付结果...')
      try {
        const data = await syncAlipayPayment(orderId)
        setResult(data)
        if (data.paymentStatus === 1) {
          setState('success')
          setMessage(data.message || '支付成功')
        } else {
          setState('pending')
          setMessage(data.message || '支付结果确认中，请稍后查看订单状态')
        }
      } catch (err: unknown) {
        setState('error')
        setMessage(err instanceof Error ? err.message : '支付结果确认失败，请稍后查看订单状态')
      }
    })()
  }, [searchParams])

  useEffect(() => {
    if (state !== 'success') return

    setRedirectSeconds(3)
    const timer = window.setInterval(() => {
      setRedirectSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          router.replace('/orders')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [router, state])

  const isSuccess = state === 'success'
  const isLoading = state === 'loading'
  const Icon = isSuccess ? CheckCircle2 : state === 'pending' || isLoading ? Clock : XCircle

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] bg-[#f7f8fa] px-5 py-12">
        <div className="max-w-[720px] mx-auto bg-white border border-[#e9e9e9] rounded-2xl shadow-sm px-6 py-12 text-center">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: isSuccess ? '#f6ffed' : state === 'error' ? '#fff1f0' : '#fff7e6' }}
          >
            <Icon
              className="w-11 h-11"
              style={{ color: isSuccess ? '#52c41a' : state === 'error' ? '#ff4d4f' : '#faad14' }}
            />
          </div>

          <h1 className="text-[26px] font-medium text-[#111] mb-3">
            {isSuccess ? '支付成功' : isLoading ? '正在确认支付结果' : state === 'pending' ? '支付结果确认中' : '支付结果确认失败'}
          </h1>
          <p className="text-[14px] text-[#666] leading-6 mb-8">{message}</p>

          {isSuccess && (
            <p className="text-[13px] text-[#999] mb-6">
              {redirectSeconds > 0 ? `${redirectSeconds} 秒后自动跳转到我的订单` : '正在跳转到我的订单...'}
            </p>
          )}

          {result && (
            <div className="bg-[#fafafa] rounded-xl px-5 py-4 mb-8 text-left text-[14px] text-[#666] inline-block min-w-[280px]">
              <div className="flex justify-between gap-8 mb-2">
                <span>订单号</span>
                <span className="text-[#111]">{result.orderNo || result.orderId}</span>
              </div>
              {result.tradeNo && (
                <div className="flex justify-between gap-8">
                  <span>交易号</span>
                  <span className="text-[#111]">{result.tradeNo}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/orders')}
              className="cursor-pointer border-none outline-none bg-[#ff1268] hover:bg-[#e01058] text-white rounded-full px-8 py-3 text-[15px] transition-colors"
            >
              查看订单
            </button>
            <button
              onClick={() => router.push('/')}
              className="cursor-pointer outline-none bg-white hover:bg-[#fff4f8] text-[#ff1268] border border-[#ff1268] rounded-full px-8 py-3 text-[15px] transition-colors"
            >
              继续浏览
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
