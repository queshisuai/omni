'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import { Pagination, DEFAULT_PAGE_SIZE } from '@/components/Pagination'
import { listOrders, listTrashOrders, cancelOrder, hideOrder, restoreOrder, createAlipayQrPay, syncAlipayPayment, listMyRefunds, applyRefund, getRefundOptions } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { formatOrderAttendees } from '@/lib/console-orders'
import { ArrowLeft, Check, Ticket as TicketIcon, Search, PackageOpen, Trash2, RotateCcw, AlertCircle, RefreshCw, EyeOff, Loader2 } from 'lucide-react'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import type { OrderEntity, QrPayResponse, RefundOptionsVO, RefundRequestVO, RefundStatus } from '@/types/api'

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
    const fallbackTicketTypeId = order.matchedTicketTypeId ?? order.ticketTypeId

    return {
      ...order,
      activityName: order.activityName || '未知活动',
      activityPoster: order.activityPoster || '',
      activityId: order.activityId ?? null,
      venueName: order.venueName || '未知场馆',
      sessionTime: order.sessionTime || '',
      ticketName: order.ticketName || `票档 ${fallbackTicketTypeId}`,
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
  const [refundReasonType, setRefundReasonType] = useState<'general' | 'cast_change'>('general')
  const [refundOptions, setRefundOptions] = useState<RefundOptionsVO | null>(null)
  const [refundQuantity, setRefundQuantity] = useState(1)
  const [selectedOrderSeatIds, setSelectedOrderSeatIds] = useState<number[]>([])
  const [refundOptionsLoading, setRefundOptionsLoading] = useState(false)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [trashOrders, setTrashOrders] = useState<EnrichedOrder[]>([])
  const [hiding, setHiding] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const loadOrdersRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const refundOptionsRequestIdRef = useRef(0)
  const refundTargetIdRef = useRef<number | null>(null)

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
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [orderData, trashData] = await Promise.all([
          listOrders(),
          listTrashOrders(),
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
    if (!(await globalConfirm('确定取消该订单吗？'))) return
    setCancelling(orderId)
    try {
      await cancelOrder(orderId)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 3 } : o)))
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '取消失败')
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
      await globalAlert(err instanceof Error ? err.message : '支付失败')
    } finally {
      setPaying(null)
    }
  }

  const handleHide = async (orderId: number) => {
    if (!(await globalConfirm('确定删除该订单吗？删除后 7 天内可在回收站恢复。'))) return
    setHiding(orderId)
    try {
      await hideOrder(orderId)
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
      await globalAlert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setHiding(null)
    }
  }

  const handleRestore = async (orderId: number) => {
    setRestoring(orderId)
    try {
      await restoreOrder(orderId)
      const target = trashOrders.find((order) => order.id === orderId)
      setTrashOrders((prev) => prev.filter((order) => order.id !== orderId))
      if (target) {
        setOrders((prev) => [{ ...target, userHidden: false, userDeletedAt: null, userDeleteExpiresAt: null }, ...prev])
      }
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '恢复失败')
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
        await globalAlert(result.message || '支付结果确认中')
      }
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '刷新支付状态失败')
    } finally {
      setRefreshing(null)
    }
  }

  const handleApplyRefund = async () => {
    if (!refundTarget) return
    if (!refundOptions) {
      await globalAlert('退款明细加载中，请稍后再试')
      return
    }
    const hasSeats = refundOptions.seats.length > 0
    const quantity = hasSeats ? selectedOrderSeatIds.length : refundQuantity
    if (quantity < 1) {
      await globalAlert(hasSeats ? '请至少选择一个座位' : '请选择退款张数')
      return
    }
    if (quantity > refundOptions.refundableQuantity) {
      await globalAlert('退款张数超过可退张数')
      return
    }
    setRefundSubmitting(true)
    try {
      const next = await applyRefund(
        refundTarget.id,
        {
          reason: refundReason.trim() || undefined,
          reasonType: refundReasonType === 'cast_change' ? 'cast_change' : undefined,
          quantity,
          orderSeatIds: hasSeats ? selectedOrderSeatIds : undefined,
        },
      )
      setRefunds((prev) => [next, ...prev.filter((item) => item.id !== next.id)])
      refundOptionsRequestIdRef.current += 1
      refundTargetIdRef.current = null
      setRefundTarget(null)
      setRefundOptions(null)
      setRefundOptionsLoading(false)
      setRefundQuantity(1)
      setSelectedOrderSeatIds([])
      setRefundReason('')
      setRefundReasonType('general')
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '申请退款失败')
    } finally {
      setRefundSubmitting(false)
    }
  }

  const openRefundDialog = async (order: EnrichedOrder) => {
    const user = getUser()
    if (!user?.userId) {
      await globalAlert('请先登录后再申请退款')
      return
    }
    const requestId = refundOptionsRequestIdRef.current + 1
    refundOptionsRequestIdRef.current = requestId
    refundTargetIdRef.current = order.id
    setRefundTarget(order)
    setRefundReason('')
    setRefundReasonType('general')
    setRefundOptions(null)
    setRefundQuantity(1)
    setSelectedOrderSeatIds([])
    setRefundOptionsLoading(true)
    try {
      const options = await getRefundOptions(order.id)
      if (refundOptionsRequestIdRef.current !== requestId || refundTargetIdRef.current !== order.id) return
      setRefundOptions(options)
      setRefundQuantity(Math.min(1, options.refundableQuantity))
    } catch (err: unknown) {
      if (refundOptionsRequestIdRef.current !== requestId || refundTargetIdRef.current !== order.id) return
      await globalAlert(err instanceof Error ? err.message : '加载退款明细失败')
      setRefundTarget(null)
      refundTargetIdRef.current = null
    } finally {
      if (refundOptionsRequestIdRef.current !== requestId || refundTargetIdRef.current !== order.id) return
      setRefundOptionsLoading(false)
    }
  }

  const closeRefundDialog = () => {
    if (refundSubmitting) return
    refundOptionsRequestIdRef.current += 1
    refundTargetIdRef.current = null
    setRefundTarget(null)
    setRefundOptions(null)
    setRefundOptionsLoading(false)
    setRefundQuantity(1)
    setSelectedOrderSeatIds([])
    setRefundReason('')
    setRefundReasonType('general')
  }

  const refundMap = buildRefundMap(refunds)
  const refundHasSeats = (refundOptions?.seats.length || 0) > 0
  const refundSelectedQuantity = refundHasSeats ? selectedOrderSeatIds.length : refundQuantity
  const estimatedRefundAmount = (refundOptions?.unitPrice || refundTarget?.unitPrice || 0) * refundSelectedQuantity

  const filteredOrders = activeTab === 'trash'
    ? trashOrders
    : activeTab === 'all'
      ? orders
      : orders.filter((o) => {
        if (activeTab === 'unpaid') return o.status === 1
        if (activeTab === 'paid') return o.status === 2
        return o.status === 3 || o.status === 4
      })

  const pageOrders = useMemo(() => filteredOrders.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [filteredOrders, page])

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
      <main className="w-full max-w-[1200px] mx-auto px-5 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <h1 className="text-[24px] text-[#111] font-medium mb-6">我的订单</h1>
        {activeTab === 'trash' && (
          <div className="mb-4 rounded bg-[#fff7e6] px-4 py-3 text-[13px] text-[#8a5a00]">
            提示：回收站内的订单最多保留 7 天，超过 7 天后将自动清理。
          </div>
        )}

        {/* 状态 Tab */}
        <div className="flex gap-0 mb-6 border-b border-[#e5e5e5]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1) }}
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
          <div className="flex flex-col gap-6">
            {pageOrders.map((order) => {
              const refundInfo = refundMap[order.id]
              const activeRefund = refundInfo?.active
              const latestRefund = refundInfo?.latest
              const lastRefundNote = latestRefund?.reviewNote || latestRefund?.reason
              return (
                <div
                  key={order.id}
                  className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300"
                >
                  {/* 订单头部 */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-[13px] text-gray-500 font-medium">
                      <span>订单号：{order.orderNo}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block"></span>
                      <span className="hidden sm:inline">{order.createTime?.slice(0, 16).replace('T', ' ') || ''}</span>
                    </div>
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium"
                      style={{ color: (STATUS_MAP[order.status] || STATUS_MAP[3]).color, backgroundColor: (STATUS_MAP[order.status] || STATUS_MAP[3]).bg }}
                    >
                      {(STATUS_MAP[order.status] || STATUS_MAP[3]).label}
                    </span>
                  </div>

                  {/* 订单内容 */}
                  <div className="flex flex-col sm:flex-row sm:items-start p-6 gap-6">
                    {/* 活动海报 */}
                    <a
                      href={order.activityId ? `/activity/${order.activityId}` : '#'}
                      className="flex-shrink-0 relative group rounded-2xl overflow-hidden shadow-sm"
                    >
                      <img
                        src={order.activityPoster || '/background.png'}
                        alt={order.activityName}
                        className="w-[110px] h-[146px] object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </a>

                    {/* 订单信息 */}
                    <div className="flex-1 flex flex-col gap-2">
                      <a
                        href={order.activityId ? `/activity/${order.activityId}` : '#'}
                        className="text-[18px] text-[#111] font-bold no-underline hover:text-[#ff1268] transition-colors line-clamp-2"
                      >
                        {order.activityName}
                      </a>
                      <div className="text-[14px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-[12px]">{order.sessionTime || '待定'}</span>
                        <span className="text-gray-400">|</span>
                        <span>{order.venueName || '待定场馆'}</span>
                      </div>
                      <div className="text-[14px] text-gray-500 mt-1 flex items-center gap-3">
                        <span className="font-medium text-gray-700">{order.ticketName || '未知票档'}</span>
                        {order.autoDowngraded && (
                          <span className="inline-flex items-center rounded border border-[#ffb3ca] bg-[#fff7fa] px-1.5 py-0.5 text-[11px] font-medium text-[#ff1268]">
                            降级成功
                          </span>
                        )}
                        <span>×{order.quantity}张</span>
                      </div>
                      <div className="text-[13px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        座位信息：<span className="text-gray-700">{order.seatLabels}</span>
                      </div>
                      {order.attendees?.length ? (
                        <div className="text-[13px] text-gray-400 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          实名观演人：<span className="text-gray-700">{formatOrderAttendees(order)}</span>
                        </div>
                      ) : null}
                      <div className="text-[22px] text-[#ff1268] font-bold mt-2">
                        <span className="text-[14px] font-medium mr-1">¥</span>{order.amount.toFixed(2)}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex-shrink-0 flex sm:flex-col items-stretch justify-end sm:justify-start gap-3 mt-4 sm:mt-0 sm:w-[140px]">
                      {activeTab !== 'trash' && order.status === 1 && (
                        <>
                          <button
                            onClick={() => handlePay(order.id)}
                            disabled={paying === order.id || refreshing === order.id || cancelling === order.id}
                            className="cursor-pointer border-none outline-none text-white text-[14px] font-medium px-5 py-2.5 rounded-full transition-colors bg-[#ff1268] hover:bg-[#e60f5f] shadow-sm shadow-[#ff1268]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {paying === order.id ? '支付中...' : '立即支付'}
                          </button>
                          <button
                            onClick={() => handleRefreshPayment(order.id)}
                            disabled={refreshing === order.id || paying === order.id || cancelling === order.id}
                            className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-[#fff0f5] disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {refreshing === order.id ? '刷新中...' : '刷新状态'}
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id || paying === order.id || refreshing === order.id}
                            className="cursor-pointer border border-gray-200 bg-white text-gray-600 text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-gray-50 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {cancelling === order.id ? '取消中...' : '取消订单'}
                          </button>
                        </>
                      )}
                      {activeTab === 'trash' ? (
                        <button
                          onClick={() => handleRestore(order.id)}
                          disabled={restoring === order.id}
                          className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-[#fff0f5] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {restoring === order.id ? '恢复中...' : '恢复订单'}
                        </button>
                      ) : order.status === 2 && (
                        <>
                          {activeRefund ? (
                            <span
                              className="text-[13px] text-center font-medium bg-gray-50 py-2 rounded-full border border-gray-100"
                              style={{ color: REFUND_STATUS_MAP[activeRefund.status].color }}
                            >
                              {REFUND_STATUS_MAP[activeRefund.status].label}
                            </span>
                          ) : (
                            <button
                              onClick={() => openRefundDialog(order)}
                              className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-[#fff0f5]"
                            >
                              申请退款
                            </button>
                          )}
                          {latestRefund && !activeRefund && (latestRefund.status === 2 || latestRefund.status === 3) && (
                            <span className="text-[12px] text-gray-400 leading-relaxed text-center mt-2 px-2">
                              上次{REFUND_STATUS_MAP[latestRefund.status].label.replace('退款', '')}：<br/>{lastRefundNote || '暂无备注'}
                            </span>
                          )}
                        </>
                      )}
                      {activeTab !== 'trash' && (order.status === 3 || order.status === 4) && (
                        <>
                          <button
                            onClick={() => handleHide(order.id)}
                            disabled={hiding === order.id}
                            className="cursor-pointer border border-gray-200 bg-white text-gray-600 text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-gray-50 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {hiding === order.id ? '删除中...' : '删除订单'}
                          </button>
                        </>
                      )}
                      {order.status === 1 && activeTab !== 'trash' && (
                        <button
                          onClick={() => handleHide(order.id)}
                          disabled={hiding === order.id || cancelling === order.id || paying === order.id || refreshing === order.id}
                          className="cursor-pointer border border-gray-200 bg-white text-gray-600 text-[14px] font-medium px-5 py-2.5 rounded-full outline-none transition-colors hover:bg-gray-50 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {hiding === order.id ? '删除中...' : '删除订单'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <Pagination page={page} total={filteredOrders.length} loading={loading} onChange={setPage} />
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
              订单金额：¥{refundTarget.amount.toFixed(2)}
            </p>
            <div className="mb-4 rounded border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-[13px] leading-6 text-[#666]">
              {refundOptionsLoading ? (
                <div>退款明细加载中...</div>
              ) : refundOptions ? (
                <>
                  <div className="flex justify-between">
                    <span>订单总票数：{refundOptions.totalQuantity} 张</span>
                    <span>已退票数：{refundOptions.refundedQuantity} 张</span>
                  </div>
                  <div className="flex justify-between">
                    <span>可退票数：{refundOptions.refundableQuantity} 张</span>
                    <span>单价：¥{refundOptions.unitPrice.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 font-medium text-[#ff1268]">
                    预计退款金额：¥{estimatedRefundAmount.toFixed(2)}
                  </div>
                </>
              ) : (
                <div>退款明细加载失败，请关闭后重试</div>
              )}
            </div>
            {refundOptions && refundHasSeats && (
              <div className="mb-4">
                <div className="mb-2 text-[13px] text-[#333]">选择退款座位</div>
                <div className="max-h-[132px] overflow-y-auto rounded border border-[#eee] p-2">
                  {refundOptions.seats.map((seat) => {
                    const selected = selectedOrderSeatIds.includes(seat.orderSeatId)
                    return (
                      <button
                        key={seat.orderSeatId}
                        type="button"
                        onClick={() => {
                          setSelectedOrderSeatIds((prev) => selected
                            ? prev.filter((id) => id !== seat.orderSeatId)
                            : [...prev, seat.orderSeatId])
                        }}
                        disabled={refundSubmitting}
                        className="mb-2 mr-2 cursor-pointer rounded border bg-white px-3 py-1.5 text-[13px] outline-none"
                        style={{
                          borderColor: selected ? '#ff1268' : '#ddd',
                          color: selected ? '#ff1268' : '#666',
                        }}
                      >
                        {seat.seatLabel || `座位 ${seat.orderSeatId}`}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-1 text-[12px] text-[#999]">已选择 {selectedOrderSeatIds.length} 张</div>
              </div>
            )}
            {refundOptions && !refundHasSeats && (
              <div className="mb-4">
                <div className="mb-2 text-[13px] text-[#333]">退款张数</div>
                <input
                  type="number"
                  min={1}
                  max={refundOptions.refundableQuantity}
                  value={refundQuantity}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    setRefundQuantity(Math.max(1, Math.min(refundOptions.refundableQuantity, Math.trunc(value))))
                  }}
                  disabled={refundSubmitting || refundOptions.refundableQuantity <= 0}
                  className="w-full rounded border border-[#ddd] px-3 py-2 text-[14px] text-[#333] outline-none focus:border-[#ff1268]"
                />
              </div>
            )}
            <div className="mb-3">
              <div className="mb-2 text-[13px] text-[#333]">退款原因类型</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefundReasonType('general')}
                  disabled={refundSubmitting}
                  className="cursor-pointer rounded border bg-white px-3 py-1.5 text-[13px] outline-none"
                  style={{
                    borderColor: refundReasonType === 'general' ? '#ff1268' : '#ddd',
                    color: refundReasonType === 'general' ? '#ff1268' : '#666',
                  }}
                >
                  常规退款
                </button>
                <button
                  type="button"
                  onClick={() => setRefundReasonType('cast_change')}
                  disabled={refundSubmitting}
                  className="cursor-pointer rounded border bg-white px-3 py-1.5 text-[13px] outline-none"
                  style={{
                    borderColor: refundReasonType === 'cast_change' ? '#ff1268' : '#ddd',
                    color: refundReasonType === 'cast_change' ? '#ff1268' : '#666',
                  }}
                >
                  阵容变更专属退款
                </button>
              </div>
              {refundReasonType === 'cast_change' && (
                <div className="mt-2 rounded bg-[#fff7fa] px-3 py-2 text-[12px] leading-5 text-[#b91c1c]">
                  仅当活动因艺人调整发出阵容变更通知时使用，可优先走加速审核通道。
                </div>
              )}
            </div>
            <textarea
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder={refundReasonType === 'cast_change' ? '可补充阵容变更对您的影响，可不填' : '请输入退款原因，可不填'}
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
                disabled={refundSubmitting || refundOptionsLoading || !refundOptions || refundOptions.refundableQuantity <= 0 || (refundHasSeats && selectedOrderSeatIds.length === 0)}
                className="cursor-pointer rounded border-none bg-[#ff1268] px-5 py-2 text-[14px] text-white outline-none"
                style={{ opacity: refundSubmitting || refundOptionsLoading || !refundOptions || refundOptions.refundableQuantity <= 0 || (refundHasSeats && selectedOrderSeatIds.length === 0) ? 0.7 : 1 }}
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
