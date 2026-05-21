'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import { listOrders, listTrashOrders, cancelOrder, hideOrder, restoreOrder, createAlipayQrPay, syncAlipayPayment, listMyRefunds, applyRefund } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import type { OrderEntity, QrPayResponse, RefundRequestVO, RefundStatus } from '@/types/api'

type StatusTab = 'all' | 'unpaid' | 'paid' | 'cancelled' | 'trash'

const STATUS_MAP: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '待支付', color: '#ff1268', bg: '#fff0f5' },
  2: { label: '已支付', color: '#52c41a', bg: '#f6ffed' },
  3: { label: '已取消', color: '#999', bg: '#f5f5f5' },
  4: { label: '已退款', color: '#999', bg: '#f5f5f5' },
}

const REFUND_STATUS_MAP: Record<RefundStatus, { label: string; color: string }> = {
  0: { label: '退款待审核', color: '#fa8c16' },
  1: { label: '已退款', color: '#52c41a' },
  2: { label: '退款已拒绝', color: '#ff4d4f' },
  3: { label: '退款失败', color: '#ff4d4f' },
  4: { label: '退款处理中', color: '#1677ff' },
}

const ACTIVE_REFUND_STATUSES = new Set<RefundStatus>([0, 1, 4])

interface EnrichedOrder extends OrderEntity {
  activityName: string
  activityPoster: string
  activityId: number | null
  venueName: string
  sessionTime: string
  ticketName: string
  unitPrice: number
  seatLabels: string
}

function enrichOrders(orders: OrderEntity[]): EnrichedOrder[] {
  return orders.map((order) => {
    return {
      ...order,
      activityName: order.activityName || '未知活动',
      activityPoster: order.activityPoster || '',
      activityId: order.activityId ?? null,
      venueName: order.venueName || '未知场馆',
      sessionTime: order.sessionTime || '',
      ticketName: order.ticketName || '未知票档',
      unitPrice: order.unitPrice || order.amount / order.quantity,
      seatLabels: order.seatLabels || '座位信息生成中',
    }
  })
}

function buildRefundMap(refunds: RefundRequestVO[]) {
  const map: Record<number, { latest?: RefundRequestVO; active?: RefundRequestVO }> = {}
  const sorted = [...refunds].sort((a, b) => {
    const byTime = new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    return byTime || b.id - a.id
  })

  for (const refund of sorted) {
    const item = map[refund.orderId] || {}
    if (!item.latest) item.latest = refund
    if (!item.active && ACTIVE_REFUND_STATUSES.has(refund.status)) item.active = refund
    map[refund.orderId] = item
  }

  return map
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [paying, setPaying] = useState<number | null>(null)
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
  const [refreshing, setRefreshing] = useState<number | null>(null)
  const [refunds, setRefunds] = useState<RefundRequestVO[]>([])
  const [refundTarget, setRefundTarget] = useState<EnrichedOrder | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [trashOrders, setTrashOrders] = useState<EnrichedOrder[]>([])
  const [hiding, setHiding] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const loadOrdersRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const loadOrders = () => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/orders')
      return
    }
    const user = getUser()
    if (!user) {
      router.replace('/login?ru=/orders')
      return
    }
    setCurrentUserId(user.userId)

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [orderData, trashData] = await Promise.all([
          listOrders(user.userId),
          listTrashOrders(user.userId),
        ])
        setOrders(enrichOrders(orderData))
        setTrashOrders(enrichOrders(trashData))
        try {
          const refundData = await listMyRefunds()
          setRefunds(refundData)
        } catch {
          setRefunds([])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '加载订单失败')
      } finally {
        setLoading(false)
      }
    })()
  }

  loadOrdersRef.current = loadOrders

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadOrdersRef.current()
  }

  useEffect(() => {
    loadOrders()
  }, [router])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshWhenVisible()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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
      const pay = await createAlipayQrPay(orderId)
      setQrPay(pay)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '支付失败')
    } finally {
      setPaying(null)
    }
  }

  const handleHide = async (orderId: number) => {
    if (!currentUserId || !confirm('确定删除该订单吗？删除后 7 天内可在回收站恢复。')) return
    setHiding(orderId)
    try {
      await hideOrder(orderId, currentUserId)
      const target = orders.find((order) => order.id === orderId)
      setOrders((prev) => prev.filter((order) => order.id !== orderId))
      if (target) {
        const now = new Date()
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        setTrashOrders((prev) => [
          { ...target, userHidden: true, userDeletedAt: now.toISOString(), userDeleteExpiresAt: expires.toISOString() },
          ...prev,
        ])
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setHiding(null)
    }
  }

  const handleRestore = async (orderId: number) => {
    if (!currentUserId) return
    setRestoring(orderId)
    try {
      await restoreOrder(orderId, currentUserId)
      const target = trashOrders.find((order) => order.id === orderId)
      setTrashOrders((prev) => prev.filter((order) => order.id !== orderId))
      if (target) {
        setOrders((prev) => [{ ...target, userHidden: false, userDeletedAt: null, userDeleteExpiresAt: null }, ...prev])
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '恢复失败')
    } finally {
      setRestoring(null)
    }
  }

  const handleRefreshPayment = async (orderId: number) => {
    setRefreshing(orderId)
    try {
      const result = await syncAlipayPayment(orderId)
      if (result.orderStatus === 2 || result.paymentStatus === 1) {
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: 2 } : order)))
        setQrPay((current) => (current?.orderId === orderId ? null : current))
      } else {
        alert(result.message || '支付结果确认中')
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '刷新支付状态失败')
    } finally {
      setRefreshing(null)
    }
  }

  const handleApplyRefund = async () => {
    if (!refundTarget) return
    setRefundSubmitting(true)
    try {
      const next = await applyRefund(refundTarget.id, refundReason.trim() || undefined)
      setRefunds((prev) => [next, ...prev.filter((item) => item.id !== next.id)])
      setRefundTarget(null)
      setRefundReason('')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '申请退款失败')
    } finally {
      setRefundSubmitting(false)
    }
  }

  const openRefundDialog = (order: EnrichedOrder) => {
    setRefundTarget(order)
    setRefundReason('')
  }

  const closeRefundDialog = () => {
    if (refundSubmitting) return
    setRefundTarget(null)
    setRefundReason('')
  }

  const refundMap = buildRefundMap(refunds)

  const filteredOrders = activeTab === 'trash'
    ? trashOrders
    : activeTab === 'all'
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
    { key: 'trash', label: '回收站' },
  ]

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-5 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <h1 className="text-[24px] text-[#111] font-medium mb-6">我的订单</h1>
        {activeTab === 'trash' && (
          <div className="mb-4 rounded bg-[#fff7e6] px-4 py-3 text-[13px] text-[#8a5a00]">
            回收站订单保留 7 天，超过后用户侧不再展示；后台仍保留完整订单记录。
          </div>
        )}

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
              const refundInfo = refundMap[order.id]
              const activeRefund = refundInfo?.active
              const latestRefund = refundInfo?.latest
              const lastRefundNote = latestRefund?.reviewNote || latestRefund?.reason
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
                      <div className="text-[13px] text-[#666]">座位：{order.seatLabels}</div>
                      <div className="text-[20px] text-[#ff1268] font-medium mt-1">
                        ¥{order.amount.toFixed(2)}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex-shrink-0 flex flex-col gap-2 ml-6">
                      {activeTab !== 'trash' && order.status === 1 && (
                        <>
                          <button
                            onClick={() => handlePay(order.id)}
                            disabled={paying === order.id || refreshing === order.id || cancelling === order.id}
                            className="cursor-pointer border-none outline-none text-white text-[14px] px-6 py-2 rounded"
                            style={{ backgroundColor: '#ff1268', opacity: paying === order.id || refreshing === order.id || cancelling === order.id ? 0.7 : 1 }}
                          >
                            {paying === order.id ? '支付中...' : '去支付'}
                          </button>
                          <button
                            onClick={() => handleRefreshPayment(order.id)}
                            disabled={refreshing === order.id || paying === order.id || cancelling === order.id}
                            className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] px-6 py-2 rounded outline-none"
                            style={{ opacity: refreshing === order.id || paying === order.id || cancelling === order.id ? 0.7 : 1 }}
                          >
                            {refreshing === order.id ? '刷新中...' : '刷新状态'}
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id || paying === order.id || refreshing === order.id}
                            className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                            style={{ opacity: cancelling === order.id || paying === order.id || refreshing === order.id ? 0.7 : 1 }}
                          >
                            {cancelling === order.id ? '取消中...' : '取消订单'}
                          </button>
                        </>
                      )}
                      {activeTab === 'trash' ? (
                        <button
                          onClick={() => handleRestore(order.id)}
                          disabled={restoring === order.id}
                          className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] px-6 py-2 rounded outline-none"
                          style={{ opacity: restoring === order.id ? 0.7 : 1 }}
                        >
                          {restoring === order.id ? '恢复中...' : '恢复订单'}
                        </button>
                      ) : order.status === 2 && (
                        <>
                          {activeRefund ? (
                            <span
                              className="text-[13px] text-center"
                              style={{ color: REFUND_STATUS_MAP[activeRefund.status].color }}
                            >
                              {REFUND_STATUS_MAP[activeRefund.status].label}
                            </span>
                          ) : (
                            <button
                              onClick={() => openRefundDialog(order)}
                              className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] px-6 py-2 rounded outline-none"
                            >
                              申请退款
                            </button>
                          )}
                          {latestRefund && !activeRefund && (latestRefund.status === 2 || latestRefund.status === 3) && (
                            <span className="max-w-[180px] text-[12px] text-[#999] leading-[18px] text-center">
                              上次{REFUND_STATUS_MAP[latestRefund.status].label.replace('退款', '')}：{lastRefundNote || '暂无备注'}
                            </span>
                          )}
                        </>
                      )}
                      {activeTab !== 'trash' && (order.status === 3 || order.status === 4) && (
                        <>
                          <span className="text-[13px] text-[#999]">{STATUS_MAP[order.status]?.label || '已取消'}</span>
                          <button
                            onClick={() => handleHide(order.id)}
                            disabled={hiding === order.id}
                            className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                            style={{ opacity: hiding === order.id ? 0.7 : 1 }}
                          >
                            {hiding === order.id ? '删除中...' : '删除订单'}
                          </button>
                        </>
                      )}
                      {order.status === 1 && activeTab !== 'trash' && (
                        <button
                          onClick={() => handleHide(order.id)}
                          disabled={hiding === order.id || cancelling === order.id || paying === order.id || refreshing === order.id}
                          className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                          style={{ opacity: hiding === order.id || cancelling === order.id || paying === order.id || refreshing === order.id ? 0.7 : 1 }}
                        >
                          {hiding === order.id ? '删除中...' : '删除订单'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      {qrPay && (
        <AlipayQrPayModal
          pay={qrPay}
          productName={orders.find((order) => order.id === qrPay.orderId)?.activityName || '万象票务订单'}
          onClose={() => setQrPay(null)}
          onPaid={(result) => {
            setOrders((prev) => prev.map((order) => (order.id === result.orderId ? { ...order, status: 2 } : order)))
            setQrPay(null)
          }}
        />
      )}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[420px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-[18px] font-medium text-[#111]">申请退款</h2>
            <p className="mb-4 text-[13px] leading-5 text-[#666]">
              订单号：{refundTarget.orderNo}<br />
              退款金额：¥{refundTarget.amount.toFixed(2)}
            </p>
            <textarea
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="请输入退款原因，可不填"
              className="mb-4 h-[96px] w-full resize-none rounded border border-[#ddd] px-3 py-2 text-[14px] text-[#333] outline-none focus:border-[#ff1268]"
              maxLength={200}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeRefundDialog}
                disabled={refundSubmitting}
                className="cursor-pointer rounded border border-[#ddd] bg-white px-5 py-2 text-[14px] text-[#666] outline-none"
                style={{ opacity: refundSubmitting ? 0.7 : 1 }}
              >
                取消
              </button>
              <button
                onClick={handleApplyRefund}
                disabled={refundSubmitting}
                className="cursor-pointer rounded border-none bg-[#ff1268] px-5 py-2 text-[14px] text-white outline-none"
                style={{ opacity: refundSubmitting ? 0.7 : 1 }}
              >
                {refundSubmitting ? '提交中...' : '确认申请'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  )
}
