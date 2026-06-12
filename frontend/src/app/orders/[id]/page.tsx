'use client'

import { useEffect, useMemo, use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Clock, Ticket } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { listMyRefunds, listOrders, listTrashOrders } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { formatOrderAttendees } from '@/lib/console-orders'
import { buildOrderDetailTimeline, formatOrderSeatLabel, getOrderDetailStatusCopy, type TimelineState } from '@/lib/orders-experience'
import { buildRefundTimeline } from '@/lib/refund-flow'
import type { OrderEntity, RefundRequestVO } from '@/types/api'

const STATUS_COLOR: Record<TimelineState, string> = {
  done: 'bg-[#16a34a] text-white',
  active: 'bg-[#ff1268] text-white',
  pending: 'bg-gray-200 text-gray-500',
  failed: 'bg-red-500 text-white',
}

function enrich(order: OrderEntity) {
  return {
    ...order,
    activityName: order.activityName || '活动信息待同步',
    activityPoster: order.activityPoster || '/background.png',
    activityId: order.activityId ?? null,
    venueName: order.venueName || '场馆信息待同步',
    sessionTime: order.sessionTime || '',
    ticketName: order.ticketName || '票档信息待同步',
    unitPrice: order.unitPrice || order.amount / order.quantity,
    seatLabels: formatOrderSeatLabel(order),
  }
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const orderId = Number(id)
  const router = useRouter()
  const [order, setOrder] = useState<ReturnType<typeof enrich> | null>(null)
  const [refunds, setRefunds] = useState<RefundRequestVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?ru=/orders/${id}`)
      return
    }
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [normalOrders, trashOrders, refundData] = await Promise.all([
          listOrders(),
          listTrashOrders(),
          listMyRefunds().catch(() => []),
        ])
        const found = [...normalOrders, ...trashOrders].find(item => item.id === orderId)
        if (!found) {
          setOrder(null)
          setError('订单不存在或无权查看')
          setRefunds([])
          return
        }
        setOrder(enrich(found))
        setRefunds(refundData.filter(item => item.orderId === orderId))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '加载订单详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, orderId, router])

  const latestRefund = useMemo(() => {
    return [...refunds].sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())[0] || null
  }, [refunds])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-12 text-center text-[14px] text-gray-500">正在加载订单详情...</main>
        <Footer />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-12 text-center">
          <p className="mb-4 text-[14px] text-gray-500">{error || '订单不存在'}</p>
          <button onClick={() => router.push('/orders')} className="rounded-lg border border-[#ff1268] px-4 py-2 text-[13px] text-[#ff1268]">返回订单列表</button>
        </main>
        <Footer />
      </div>
    )
  }

  const statusCopy = getOrderDetailStatusCopy(order.status)
  const timeline = buildOrderDetailTimeline(order, latestRefund)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 md:pb-0">
      <Header />
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-8">
        <button onClick={() => router.push('/orders')} className="mb-5 inline-flex items-center gap-1 text-[13px] text-gray-500 hover:text-[#ff1268]">
          <ArrowLeft className="h-4 w-4" />
          返回订单列表
        </button>

        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-bold text-[#111]">{statusCopy.title}</h1>
              <p className="mt-2 text-[14px] text-gray-500">{statusCopy.description}</p>
              <p className="mt-3 text-[13px] text-gray-400">订单号：{order.orderNo}</p>
            </div>
            <div className="text-right">
              <div className="text-[13px] text-gray-400">实付金额</div>
              <div className="mt-1 text-[26px] font-bold text-[#ff1268]">¥{order.amount.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {timeline.map(item => (
              <div key={item.label} className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${STATUS_COLOR[item.state]}`}>
                    {item.state === 'pending' ? <Clock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-[14px] font-medium text-[#111]">{item.label}</span>
                </div>
                <div className="text-[12px] text-gray-400">{item.time ? item.time.slice(0, 16).replace('T', ' ') : '待更新'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex gap-5">
            <img src={order.activityPoster} alt={order.activityName} className="h-[160px] w-[120px] shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 text-[20px] font-bold text-[#111]">{order.activityName}</h2>
              <div className="mt-4 grid gap-3 text-[14px] text-gray-500 md:grid-cols-2">
                <div>场次：<span className="text-gray-800">{order.sessionTime || '待定'}</span></div>
                <div>场馆：<span className="text-gray-800">{order.venueName}</span></div>
                <div>票档：<span className="text-gray-800">{order.ticketName}</span></div>
                <div>数量：<span className="text-gray-800">{order.quantity} 张</span></div>
                <div className="md:col-span-2">座位：<span className="text-gray-800">{order.seatLabels}</span></div>
                {order.attendees?.length ? (
                  <div className="md:col-span-2">实名观演人：<span className="text-gray-800">{formatOrderAttendees(order)}</span></div>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {order.activityId && <Link href={`/activity/${order.activityId}`} className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]">查看活动</Link>}
                {order.status === 2 && <Link href="/tickets" className="inline-flex items-center gap-1 rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white"><Ticket className="h-4 w-4" />查看电子票</Link>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[18px] font-bold text-[#111]">退款与售后</h2>
          {latestRefund ? (
            <div>
              <div className="mb-4 rounded-xl bg-gray-50 p-4 text-[13px] text-gray-500">
                退款单号：{latestRefund.refundNo} · 申请金额 ¥{latestRefund.amount.toFixed(2)}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {buildRefundTimeline(latestRefund).map(step => (
                  <div key={step.label} className="rounded-xl border border-gray-100 p-4">
                    <div className="mb-1 text-[14px] font-medium text-[#111]">{step.label}</div>
                    <div className="text-[12px] text-gray-400">{step.time ? step.time.slice(0, 16).replace('T', ' ') : '待更新'}</div>
                  </div>
                ))}
              </div>
              {latestRefund.reviewNote && <p className="mt-4 text-[13px] text-gray-500">审核备注：{latestRefund.reviewNote}</p>}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-4 text-[13px] leading-6 text-gray-500">
              暂无退款记录。每个活动的退票规则以下单前确认和活动页展示为准；遇到改期、取消或退款异常可进入在线客服处理。
              <Link href="/help" className="ml-2 font-medium text-[#ff1268]">联系在线客服</Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
