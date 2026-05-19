'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { syncAlipayPayment } from '@/lib/api'
import type { PaymentStatusResponse, QrPayResponse } from '@/types/api'

type PayState = 'pending' | 'checking' | 'success' | 'error'

interface AlipayQrPayModalProps {
  pay: QrPayResponse
  productName: string
  onClose: () => void
  onPaid: (result: PaymentStatusResponse) => void
}

export function AlipayQrPayModal({ pay, productName, onClose, onPaid }: AlipayQrPayModalProps) {
  const [state, setState] = useState<PayState>('pending')
  const [message, setMessage] = useState('待支付')
  const [checking, setChecking] = useState(false)
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
  const statusColor = state === 'success' ? '#52c41a' : state === 'error' ? '#ff4d4f' : '#ff1268'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alipay-qr-pay-title"
        className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="alipay-qr-pay-title" className="text-[20px] font-medium text-[#111]">支付宝扫码支付</h3>
            <p className="mt-1 text-[13px] text-[#999]">请使用支付宝扫码完成付款</p>
          </div>
          <button onClick={onClose} aria-label="关闭支付弹窗" className="border-none bg-transparent text-[24px] leading-none text-[#999] cursor-pointer">×</button>
        </div>

        <div className="mb-5 rounded-xl bg-[#fafafa] p-4 text-[14px] text-[#666] space-y-2">
          <div className="flex justify-between gap-4"><span>产品</span><span className="text-right text-[#111]">{productName}</span></div>
          <div className="flex justify-between gap-4"><span>金额</span><span className="text-[#ff1268] text-[18px] font-medium">¥{Number(pay.amount).toFixed(2)}</span></div>
          <div className="flex justify-between gap-4"><span>状态</span><span style={{ color: statusColor }}>{statusText}</span></div>
          <div className="flex justify-between gap-4"><span>订单号</span><span className="text-right text-[#111]">{pay.orderNo}</span></div>
        </div>

        <div className="mb-5 flex flex-col items-center rounded-xl border border-[#f0f0f0] p-5">
          {state === 'success' ? (
            <div className="flex h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#52c41a] bg-[#f6ffed] text-[34px] text-[#52c41a]">✓</div>
              <div className="text-[18px] font-medium text-[#111]">支付成功</div>
            </div>
          ) : (
            <QRCodeSVG value={pay.qrCode} size={220} includeMargin />
          )}
          <p className="mt-3 text-center text-[13px] text-[#999]">{message}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={refreshStatus} disabled={checking || state === 'success'} className="flex-1 rounded-lg border border-[#ff1268] bg-white py-2.5 text-[14px] text-[#ff1268] disabled:opacity-50 cursor-pointer">
            {checking ? '刷新中...' : '刷新状态'}
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg border-none bg-[#ff1268] py-2.5 text-[14px] text-white cursor-pointer">
            {state === 'success' ? '完成' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  )
}
