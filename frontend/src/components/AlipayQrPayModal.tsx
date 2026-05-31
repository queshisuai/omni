'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, RefreshCw } from 'lucide-react'
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
  const statusColor = state === 'success' ? '#52c41a' : state === 'error' ? '#ff4d4f' : '#1677ff'

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
            <div className="w-9 h-9 rounded-lg bg-[#1677ff] flex items-center justify-center text-white font-bold text-[18px] shadow-sm">支</div>
            <div>
              <h3 id="alipay-qr-pay-title" className="text-[18px] font-medium text-[#111]">支付宝扫码支付</h3>
              <p className="text-[12px] text-[#999] mt-0.5">请打开支付宝应用扫一扫</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭支付弹窗" className="border-none bg-transparent text-[24px] leading-none text-[#999] hover:text-[#333] transition-colors cursor-pointer">×</button>
        </div>

        <div className="mb-6 rounded-xl bg-[#f8f9fa] p-4 text-[14px] text-[#555] space-y-3 border border-[#f0f0f0]">
          <div className="flex justify-between gap-4">
            <span className="text-[#888]">商品名称</span>
            <span className="text-right font-medium text-[#333] truncate max-w-[260px]" title={productName}>{productName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#888]">交易单号</span>
            <span className="text-right font-mono text-[13px] text-[#333]">{pay.orderNo}</span>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="text-[#888]">支付金额</span>
            <span className="text-[#ff5000] text-[20px] font-semibold">¥{Number(pay.amount).toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center">
          <div className="relative rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#f0f0f0]">
            {state === 'success' ? (
              <div className="flex h-[200px] w-[200px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-4 h-14 w-14 text-[#52c41a]" />
                <div className="text-[16px] font-medium text-[#333]">支付成功</div>
              </div>
            ) : (
              <QRCodeSVG value={pay.qrCode} size={200} includeMargin={false} />
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {state === 'pending' || state === 'checking' ? (
              <div className="w-2 h-2 rounded-full bg-[#1677ff] animate-pulse"></div>
            ) : null}
            <p className="text-center text-[14px] font-medium" style={{ color: statusColor }}>{message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={refreshStatus} disabled={checking || state === 'success'} className="flex-1 rounded-xl border border-[#1677ff] bg-[#f0f6ff] py-3 text-[14px] font-medium text-[#1677ff] disabled:opacity-50 disabled:bg-[#f5f5f5] disabled:border-[#ddd] disabled:text-[#999] hover:bg-[#e6f0ff] transition-colors cursor-pointer flex items-center justify-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '正在确认...' : '我已完成付款'}
          </button>
        </div>
      </div>
    </div>
  )
}
