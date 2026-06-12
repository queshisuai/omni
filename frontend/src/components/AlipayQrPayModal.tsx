'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react'
import { syncAlipayPayment } from '@/lib/api'
import type { PagePayResponse, PaymentStatusResponse } from '@/types/api'

type PayState = 'pending' | 'checking' | 'success' | 'error'

interface AlipayQrPayModalProps {
  pay: PagePayResponse
  productName: string
  amount?: number | null
  onClose: () => void
  onPaid: (result: PaymentStatusResponse) => void
}

function buildPaymentPageHtml(payForm: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>支付宝支付</title>
</head>
<body>
${payForm}
<script>
  (function () {
    var form = document.forms && document.forms[0];
    if (form) form.submit();
  })();
</script>
</body>
</html>`
}

export function AlipayQrPayModal({ pay, productName, amount, onClose, onPaid }: AlipayQrPayModalProps) {
  const [state, setState] = useState<PayState>('pending')
  const [message, setMessage] = useState('待支付')
  const [checking, setChecking] = useState(false)
  const [paymentPageUrl, setPaymentPageUrl] = useState('')
  const checkingRef = useRef(false)
  const paidRef = useRef(false)
  const orderIdRef = useRef(pay.orderId)

  const refreshStatus = async () => {
    if (checkingRef.current || paidRef.current) return
    const checkingOrderId = pay.orderId
    checkingRef.current = true
    setChecking(true)
    setState('checking')
    setMessage('正在刷新支付状态...')
    try {
      const result = await syncAlipayPayment(checkingOrderId)
      if (orderIdRef.current !== checkingOrderId) return
      if (result.paymentStatus === 1 || result.orderStatus === 2) {
        paidRef.current = true
        setState('success')
        setMessage(result.message || '支付成功')
        onPaid(result)
      } else {
        setState('pending')
        setMessage(result.message || '待支付')
      }
    } catch (err: unknown) {
      if (orderIdRef.current !== checkingOrderId) return
      setState('error')
      setMessage(err instanceof Error ? err.message : '支付状态刷新失败')
    } finally {
      if (orderIdRef.current === checkingOrderId) {
        checkingRef.current = false
        setChecking(false)
      }
    }
  }

  useEffect(() => {
    orderIdRef.current = pay.orderId
    checkingRef.current = false
    paidRef.current = false
    setState('pending')
    setMessage('待支付')
    setChecking(false)
  }, [pay.orderId])

  useEffect(() => {
    const html = buildPaymentPageHtml(pay.payForm)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    setPaymentPageUrl(url)
    return () => {
      window.URL.revokeObjectURL(url)
    }
  }, [pay.payForm])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [pay.orderId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const statusText = state === 'success' ? '支付成功' : state === 'checking' ? '确认中' : state === 'error' ? '确认失败' : '待支付'
  const statusColor = state === 'success' ? '#52c41a' : state === 'error' ? '#ff4d4f' : '#1677ff'
  const amountValue = amount == null ? null : Number(amount)
  const amountText = amountValue != null && Number.isFinite(amountValue) ? amountValue.toFixed(2) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alipay-qr-pay-title"
        className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1677ff] text-[18px] font-bold text-white shadow-sm">支</div>
            <div>
              <h3 id="alipay-qr-pay-title" className="text-[18px] font-medium text-[#111]">支付宝支付</h3>
              <p className="mt-0.5 text-[12px] text-[#999]">二维码加载不及时，可直接打开支付页面</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭支付弹窗" className="cursor-pointer border-none bg-transparent text-[24px] leading-none text-[#999] transition-colors hover:text-[#333]">×</button>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-[#f0f0f0] bg-[#f8f9fa] p-4 text-[14px] text-[#555]">
          <div className="flex justify-between gap-4">
            <span className="text-[#888]">商品名称</span>
            <span className="max-w-[260px] truncate text-right font-medium text-[#333]" title={productName}>{productName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#888]">交易单号</span>
            <span className="text-right font-mono text-[13px] text-[#333]">{pay.orderNo}</span>
          </div>
          {amountText ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#888]">支付金额</span>
              <span className="text-[20px] font-semibold text-[#ff5000]">¥{amountText}</span>
            </div>
          ) : null}
        </div>

        <div className="mb-6 flex flex-col items-center">
          <div className="relative rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {state === 'success' ? (
              <div className="flex h-[200px] w-[200px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-4 h-14 w-14 text-[#52c41a]" />
                <div className="text-[16px] font-medium text-[#333]">支付成功</div>
              </div>
            ) : (
              <div className="flex h-[200px] w-[200px] flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-full bg-[#eaf3ff] p-3 text-[#1677ff]">
                  <ExternalLink className="h-8 w-8" />
                </div>
                <div className="text-[15px] font-medium text-[#333]">支付宝支付页面</div>
                <p className="mt-2 text-[12px] leading-5 text-[#888]">新窗口打开后按支付宝页面提示完成支付。</p>
                <a
                  href={paymentPageUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="打开支付宝支付页面"
                  aria-disabled={!paymentPageUrl}
                  onClick={(event) => {
                    if (!paymentPageUrl) event.preventDefault()
                  }}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1677ff] px-4 py-2.5 text-[14px] font-medium text-white no-underline transition-colors hover:bg-[#0f66d6] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                >
                  打开支付宝支付页面
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {state === 'pending' || state === 'checking' ? (
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#1677ff]"></div>
            ) : null}
            <p className="text-center text-[14px] font-medium" style={{ color: statusColor }}>{statusText}：{message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={refreshStatus} disabled={checking || state === 'success'} className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#1677ff] bg-[#f0f6ff] py-3 text-[14px] font-medium text-[#1677ff] transition-colors hover:bg-[#e6f0ff] disabled:cursor-not-allowed disabled:border-[#ddd] disabled:bg-[#f5f5f5] disabled:text-[#999] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '正在确认...' : '我已完成付款'}
          </button>
        </div>
      </div>
    </div>
  )
}
