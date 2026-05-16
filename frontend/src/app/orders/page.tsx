'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { listOrders, cancelOrder, payOrder } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { sections } from '@/lib/mock-data'
import type { OrderEntity } from '@/types/api'

type StatusTab = 'all' | 'unpaid' | 'paid' | 'cancelled'

const STATUS_MAP: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '待支付', color: '#ff1268', bg: '#fff0f5' },
  2: { label: '已支付', color: '#52c41a', bg: '#f6ffed' },
  3: { label: '已取消', color: '#999', bg: '#f5f5f5' },
  4: { label: '已退款', color: '#999', bg: '#f5f5f5' },
}

interface EnrichedOrder extends OrderEntity {
  activityName: string
  activityPoster: string
  activityId: string
  venueName: string
  sessionTime: string
  ticketName: string
  unitPrice: number
}

/** 用 mock 数据丰富订单信息 */
function enrichMockOrders(orders: OrderEntity[]): EnrichedOrder[] {
  const allActivities = sections.flatMap((s) => s.items)
  return orders.map((order) => {
    const activity = allActivities[order.id % allActivities.length]
    return {
      ...order,
      activityName: activity?.title || '未知活动',
      activityPoster: activity?.poster || '',
      activityId: activity?.id || '',
      venueName: activity?.venue || '未知场馆',
      sessionTime: activity?.showTime || '',
      ticketName: order.amount > 500 ? 'VIP票' : order.amount > 200 ? '普通票' : '早鸟票',
      unitPrice: order.amount / order.quantity,
    }
  })
}

/** Mock 订单数据 */
function buildMockOrders(): EnrichedOrder[] {
  const allActivities = sections.flatMap((s) => s.items)
  const raw: OrderEntity[] = [
    { id: 1, orderNo: 'DM202605150001', userId: 1, sessionId: 1, ticketTypeId: 1, quantity: 2, amount: 640, status: 0, createTime: '2026-05-15T14:30:00' },
    { id: 2, orderNo: 'DM202605140002', userId: 1, sessionId: 2, ticketTypeId: 2, quantity: 1, amount: 880, status: 1, createTime: '2026-05-14T10:00:00' },
    { id: 3, orderNo: 'DM202605100003', userId: 1, sessionId: 3, ticketTypeId: 1, quantity: 2, amount: 560, status: 2, createTime: '2026-05-10T20:15:00' },
  ]
  return enrichMockOrders(raw)
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [paying, setPaying] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/orders')
      return
    }
    const user = getUser()
    if (!user) {
      router.replace('/login?ru=/orders')
      return
    }

    ;(async () => {
      setLoading(true)
      try {
        const data = await listOrders(user.userId)
        setOrders(enrichMockOrders(data))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '加载订单失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleCancel = async (orderId: number) => {
    if (!confirm('确定取消该订单吗？')) return
    setCancelling(orderId)
    try {
      await cancelOrder(orderId)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 3 } : o)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '取消失败')
    } finally {
      setCancelling(null)
    }
  }

  const handlePay = async (orderId: number) => {
    setPaying(orderId)
    try {
      await payOrder(orderId)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 2 } : o)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '支付失败')
    } finally {
      setPaying(null)
    }
  }

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter((o) => {
        if (activeTab === 'unpaid') return o.status === 1
        if (activeTab === 'paid') return o.status === 2
        return o.status === 3 || o.status === 4
      })

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: '全部订单' },
    { key: 'unpaid', label: '待支付' },
    { key: 'paid', label: '已支付' },
    { key: 'cancelled', label: '已取消' },
  ]

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-5 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <h1 className="text-[24px] text-[#111] font-medium mb-6">我的订单</h1>

        {/* 状态 Tab */}
        <div className="flex gap-0 mb-6 border-b border-[#e5e5e5]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="cursor-pointer border-none bg-transparent outline-none px-6 py-3 text-[14px] transition-colors border-b-2 -mb-[1px]"
              style={{
                color: activeTab === tab.key ? '#ff1268' : '#666',
                borderBottomColor: activeTab === tab.key ? '#ff1268' : 'transparent',
                fontWeight: activeTab === tab.key ? 500 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 状态处理 */}
        {loading ? (
          <div className="text-center py-20 text-[#999] text-sm">加载中...</div>
        ) : error ? (
          <div className="text-center py-20 text-[#999] text-sm">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#999] text-sm mb-4">暂无订单</p>
            <button
              onClick={() => router.push('/')}
              className="cursor-pointer border-none bg-transparent outline-none text-[#ff1268] text-sm"
            >
              去逛逛
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_MAP[order.status] || STATUS_MAP[3]
              return (
                <div
                  key={order.id}
                  className="bg-white border border-[#e9e9e9] rounded-lg overflow-hidden"
                >
                  {/* 订单头部 */}
                  <div className="flex items-center justify-between px-5 py-3 bg-[#fafafa] border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-4 text-[12px] text-[#999]">
                      <span>订单号：{order.orderNo}</span>
                      <span>{order.createTime?.slice(0, 16).replace('T', ' ') || ''}</span>
                    </div>
                    <span
                      className="inline-block px-2.5 py-0.5 rounded text-[12px]"
                      style={{ color: (STATUS_MAP[order.status] || STATUS_MAP[3]).color, backgroundColor: (STATUS_MAP[order.status] || STATUS_MAP[3]).bg }}
                    >
                      {(STATUS_MAP[order.status] || STATUS_MAP[3]).label}
                    </span>
                  </div>

                  {/* 订单内容 */}
                  <div className="flex items-center p-5">
                    {/* 活动海报 */}
                    <a
                      href={order.activityId ? `/activity/${order.activityId}` : '#'}
                      className="flex-shrink-0 mr-4"
                    >
                      <img
                        src={order.activityPoster || '/background.png'}
                        alt={order.activityName}
                        className="w-[100px] h-[133px] object-cover rounded"
                      />
                    </a>

                    {/* 订单信息 */}
                    <div className="flex-1 flex flex-col gap-1.5">
                      <a
                        href={order.activityId ? `/activity/${order.activityId}` : '#'}
                        className="text-[16px] text-[#111] font-medium no-underline hover:text-[#ff1268] transition-colors"
                      >
                        {order.activityName}
                      </a>
                      <div className="text-[13px] text-[#666]">
                        <span>场次：{order.sessionTime || '待定'}</span>
                        <span className="mx-2">|</span>
                        <span>{order.venueName || '待定场馆'}</span>
                      </div>
                      <div className="text-[13px] text-[#666]">
                        <span>{order.ticketName || '未知票档'}</span>
                        <span className="mx-2">|</span>
                        <span>×{order.quantity}张</span>
                        <span className="mx-2">|</span>
                        <span>单价 ¥{(order.unitPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="text-[20px] text-[#ff1268] font-medium mt-1">
                        ¥{order.amount.toFixed(2)}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex-shrink-0 flex flex-col gap-2 ml-6">
                      {order.status === 1 && (
                        <>
                          <button
                            onClick={() => handlePay(order.id)}
                            disabled={paying === order.id}
                            className="cursor-pointer border-none outline-none text-white text-[14px] px-6 py-2 rounded"
                            style={{ backgroundColor: '#ff1268', opacity: paying === order.id ? 0.7 : 1 }}
                          >
                            {paying === order.id ? '支付中...' : '去支付'}
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id}
                            className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                            style={{ opacity: cancelling === order.id ? 0.7 : 1 }}
                          >
                            {cancelling === order.id ? '取消中...' : '取消订单'}
                          </button>
                        </>
                      )}
                      {order.status === 2 && (
                        <span className="text-[13px] text-[#52c41a]">已支付</span>
                      )}
                      {(order.status === 3 || order.status === 4) && (
                        <span className="text-[13px] text-[#999]">{STATUS_MAP[order.status]?.label || '已取消'}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
