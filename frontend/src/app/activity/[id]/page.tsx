'use client'

import { useState, useEffect, use, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SeatCraftSelector } from '@/components/seatcraft-unified/SeatCraftSelector'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import { getActivityDetail, submitGrabRequest, getGrabRequest, createAlipayQrPay, getSeatMap } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { buildZoomTargetFromTicketGroup, toSeatCraftSelectionModel } from '@/components/seatcraft-unified/adapters'
import type { ActivityDetailVO, QrPayResponse, SeatMapResponse, SessionDetail, SessionSeatVO, TicketTypeEntity } from '@/types/api'

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<ActivityDetailVO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketTypeEntity | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showConfirm, setShowConfirm] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successOrderNo, setSuccessOrderNo] = useState('')
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [seatMapLoading, setSeatMapLoading] = useState(false)
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const seatMapRequestIdRef = useRef(0)
  const loadDetailRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const seatCraftSelectionModel = useMemo(() => seatMap ? toSeatCraftSelectionModel(seatMap) : null, [seatMap])
  const seatCraftFocusTarget = useMemo(() => {
    if (!seatMap?.layout || selectedTicket?.id == null) return null
    return buildZoomTargetFromTicketGroup(seatMap.layout, selectedTicket.id)
  }, [seatMap?.layout, selectedTicket?.id])
  const showsSeatCraftSelection = seatMap?.layout && (seatMap.layout.blockLayout?.blocks?.length || seatMap.layout.blocks?.length) && seatCraftSelectionModel
  const availableSeatIdSet = useMemo(() => {
    if (!seatMap) return null
    const ids = seatCraftSelectionModel?.availableSeatIds
      ?? seatMap.seats
        .filter(seat => seat.status === 1 && (seat.ticketTypeId == null || seat.ticketTypeId === selectedTicket?.id))
        .map(seat => seat.id)
    return new Set(ids)
  }, [seatCraftSelectionModel, seatMap, selectedTicket?.id])
  const validSelectedSeatIds = useMemo(
    () => availableSeatIdSet ? selectedSeatIds.filter(id => availableSeatIdSet.has(id)) : selectedSeatIds,
    [availableSeatIdSet, selectedSeatIds],
  )
  const seatMapPublished = detail?.activity.seatMapVisibility === 'published'

  const loadDetail = async () => {
    setLoading(true)
    setError('')
    setSelectedSession(null)
    setSelectedTicket(null)
    try {
      const data = await getActivityDetail(Number(id))
      setDetail(data)
      if (data.sessions.length > 0) {
        setSelectedSession(data.sessions[0])
        if (data.sessions[0].ticketTypes.length > 0) {
          setSelectedTicket(data.sessions[0].ticketTypes[0])
        }
      }
    } catch (err: unknown) {
      setDetail(null)
      setError(err instanceof Error ? err.message : '加载活动失败')
    } finally {
      setLoading(false)
    }
  }

  loadDetailRef.current = loadDetail

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    void loadDetailRef.current()
  }

  const waitForGrabResult = async (requestId: string) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await getGrabRequest(requestId)
      if (result.status === 'ORDER_CREATED' || result.status === 'SOLD_OUT' || result.status === 'LIMITED' || result.status === 'FAILED' || result.status === 'EXPIRED') {
        return result
      }
      await new Promise(resolve => setTimeout(resolve, 800))
    }
    throw new Error('抢票排队超时，请稍后查看订单')
  }

  useEffect(() => {
    void loadDetail()
  }, [id])

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

  useEffect(() => {
    const requestId = ++seatMapRequestIdRef.current
    let cancelled = false

    if (!selectedSession || !selectedTicket || !seatMapPublished) {
      setSeatMap(null)
      setSelectedSeatIds([])
      setSeatMapLoading(false)
      return
    }
    setSeatMapLoading(true)
    setSelectedSeatIds([])
    getSeatMap(selectedSession.session.id, selectedTicket.id)
      .then((data) => {
        if (cancelled || seatMapRequestIdRef.current !== requestId) return
        setSeatMap(data)
      })
      .catch(() => {
        if (cancelled || seatMapRequestIdRef.current !== requestId) return
        setSeatMap(null)
      })
      .finally(() => {
        if (cancelled || seatMapRequestIdRef.current !== requestId) return
        setSeatMapLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedSession, selectedTicket, seatMapPublished])

  const handleBuy = () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    if (!selectedTicket) return
    setOrderError('')
    setShowConfirm(true)
  }

  const handleAutoSelectSeats = () => {
    if (!seatMap) return
    const available = seatMap.seats.filter(seat => seat.status === 1 && (seat.ticketTypeId == null || seat.ticketTypeId === selectedTicket?.id))
    if (seatMap.layout && seatMap.layout.sections.length > 0) {
      const bySection = new Map<string, SessionSeatVO[]>()
      for (const seat of available) {
        const key = seat.layoutSectionId != null ? `L-${seat.layoutSectionId}-${seat.rowNo}` : `${seat.areaId}-${seat.rowNo}`
        bySection.set(key, [...(bySection.get(key) || []), seat])
      }
      for (const rowSeats of bySection.values()) {
        const sorted = rowSeats.sort((a, b) => a.seatNo - b.seatNo)
        for (let i = 0; i <= sorted.length - quantity; i++) {
          const candidate = sorted.slice(i, i + quantity)
          const continuous = candidate.every((seat, index) => index === 0 || seat.seatNo === candidate[index - 1].seatNo + 1)
          if (continuous) {
            setSelectedSeatIds(candidate.map(seat => seat.id))
            return
          }
        }
      }
    }
    setSelectedSeatIds(available.slice(0, quantity).map(seat => seat.id))
  }

  const handleConfirmOrder = async () => {
    if (!selectedSession || !selectedTicket) return
    const user = getUser()
    if (!user) { router.push(`/login?ru=/activity/${id}`); return }

    setOrdering(true)
    setOrderError('')
    try {
      const seatIds = Boolean(showsSeatCraftSelection) ? validSelectedSeatIds : []
      if (showsSeatCraftSelection && validSelectedSeatIds.length !== quantity) {
        setOrderError('请选择对应数量的座位')
        return
      }
      const idempotencyKey = `${user.userId}-${selectedSession.session.id}-${selectedTicket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const grab = await submitGrabRequest({
        sessionId: selectedSession.session.id,
        ticketTypeId: selectedTicket.id,
        seatIds,
        quantity,
        allocateRandom: Boolean(showsSeatCraftSelection && seatIds.length === 0),
        idempotencyKey,
      })
      const result = grab.status === 'ORDER_CREATED' ? grab : await waitForGrabResult(grab.requestId)
      if (result.status !== 'ORDER_CREATED' || !result.orderId) {
        setOrderError(result.failReason || '抢票失败，请稍后重试')
        return
      }
      const pay = await createAlipayQrPay(result.orderId)
      setQrPay(pay)
      setShowConfirm(false)
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : '下单失败，请确认已登录并重试')
    } finally {
      setOrdering(false)
    }
  }

  // 加载态
  if (loading) {
    return (
      <>
        <Header />
        <div className="max-w-[1200px] mx-auto px-5 py-20 text-center text-[#999] text-sm">加载中...</div>
        <Footer />
      </>
    )
  }

  // 错误态
  if (error || !detail) {
    return (
      <>
        <Header />
        <div className="max-w-[1200px] mx-auto px-5 py-20 text-center">
          <p className="text-[#999] text-sm mb-4">{error || '活动不存在'}</p>
          <button onClick={() => router.back()} className="text-[#ff1268] text-sm cursor-pointer border-none bg-transparent outline-none">返回</button>
        </div>
        <Footer />
      </>
    )
  }

  const { activity, category, artist, sessions } = detail
  const artistSummary = detail.artists?.length
    ? detail.artists.map(item => item.roleName ? `${item.name}（${item.roleName}）` : item.name).filter(Boolean).join('、')
    : artist?.name

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="flex gap-5 items-start">
          {/* 左侧：占比约 2/3 */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            {/* 顶部：活动基本信息与购票 */}
            <div className="bg-white rounded-lg p-6 border border-[#e5e5e5]">
              <div className="flex gap-8 mb-10">
          {/* 海报 */}
          <div className="flex-shrink-0" style={{ width: 280, height: 373 }}>
            <img
              src={activity.poster || '/background.png'}
              alt={activity.name}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>

          {/* 信息 */}
          <div className="flex-1">
            <h1 className="text-[24px] text-[#111] font-medium mb-3">{activity.name}</h1>
            {artistSummary && (
              <p className="text-[14px] text-[#666] mb-2">
                艺人：<span className="text-[#ff1268]">{artistSummary}</span>
              </p>
            )}
            {category && (
              <p className="text-[14px] text-[#666] mb-2">类型：{category.name}</p>
            )}
            {activity.description && (
              <p className="text-[14px] text-[#999] leading-relaxed mt-4">{activity.description}</p>
            )}
          </div>
        </div>

              {/* 场次和票档 */}
              <div>
                <h2 className="text-[18px] text-[#111] font-medium mb-6">选择场次</h2>

          {sessions.length === 0 ? (
            <p className="text-[#999] text-sm py-8 text-center">暂无可用场次</p>
          ) : (
            <>
              {/* 场次列表 */}
              <div className="flex flex-wrap gap-3 mb-6">
                {sessions.map((sd) => (
                  <button
                    key={sd.session.id}
                    onClick={() => {
                      setSelectedSession(sd)
                      if (sd.ticketTypes.length > 0) {
                        setSelectedTicket(sd.ticketTypes[0])
                      } else {
                        setSelectedTicket(null)
                      }
                    }}
                    className="cursor-pointer border outline-none px-5 py-2.5 rounded text-sm transition-colors"
                    style={{
                      backgroundColor: selectedSession?.session.id === sd.session.id ? '#fff0f5' : '#fff',
                      borderColor: selectedSession?.session.id === sd.session.id ? '#ff1268' : '#e5e5e5',
                      color: selectedSession?.session.id === sd.session.id ? '#ff1268' : '#333',
                    }}
                  >
                    <div className="font-medium">
                      {sd.session.startTime ? sd.session.startTime.slice(0, 16).replace('T', ' ') : ''}
                    </div>
                    {sd.venue && (
                      <div className="text-xs mt-1 opacity-70">{sd.venue.name} - {sd.venue.city}</div>
                    )}
                  </button>
                ))}
              </div>

              {/* 票档列表 */}
              {selectedSession && (
                <>
                  <h3 className="text-[16px] text-[#111] font-medium mb-4">选择票档</h3>
                  <div className="flex flex-wrap gap-3 mb-6">
                    {selectedSession.ticketTypes.length === 0 ? (
                      <p className="text-[#999] text-sm">票档待公布</p>
                    ) : (
                      selectedSession.ticketTypes.map((tt) => (
                        <button
                          key={tt.id}
                          onClick={() => { setSelectedTicket(tt); setQuantity(1); setSelectedSeatIds([]) }}
                          className="cursor-pointer border outline-none px-5 py-3 rounded text-sm transition-colors min-w-[100px]"
                          style={{
                            backgroundColor: selectedTicket?.id === tt.id ? '#fff0f5' : '#fff',
                            borderColor: selectedTicket?.id === tt.id ? '#ff1268' : '#e5e5e5',
                            color: selectedTicket?.id === tt.id ? '#ff1268' : '#333',
                          }}
                        >
                          <div className="font-medium">{tt.name}</div>
                          <div className="text-[18px] text-[#ff1268] font-medium mt-1">
                            ¥{tt.price}
                          </div>
                          <div className="text-xs text-[#999] mt-0.5">
                            {tt.remainStock == null ? '待生成库存' : tt.remainStock > 0 ? `余${tt.remainStock}张` : '售罄'}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* 数量选择 + 购买按钮 */}
                  {selectedTicket && selectedTicket.remainStock > 0 && (
                    <>
                      <div className="mb-5">
                        {seatMapPublished && seatMapLoading ? (
                          <div className="rounded-lg border border-[#e5e5e5] p-6 text-center text-[13px] text-[#999]">正在加载座位图...</div>
                        ) : seatMapPublished && showsSeatCraftSelection ? (
                          <div>
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-[14px] text-[#666]">已选 {validSelectedSeatIds.length} / {quantity} 座</div>
                              <button onClick={handleAutoSelectSeats} className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]">自动分配</button>
                            </div>
                            <SeatCraftSelector
                              selectionModel={seatCraftSelectionModel}
                              selectedSeatIds={validSelectedSeatIds}
                              onChange={setSelectedSeatIds}
                              maxSelectable={quantity}
                              focusTarget={seatCraftFocusTarget}
                            />
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[#e5e5e5] p-6 text-center text-[13px] text-[#999]">
                            座位图暂不公布，座位将在下单后由系统自动分配。
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 pt-4 border-t border-[#f0f0f0]">
                        <span className="text-[14px] text-[#666]">数量</span>
                        <div className="flex items-center border border-[#e5e5e5] rounded">
                          <button
                            onClick={() => { setQuantity(Math.max(1, quantity - 1)); setSelectedSeatIds(ids => ids.slice(0, Math.max(1, quantity - 1))) }}
                            className="w-8 h-8 flex items-center justify-center cursor-pointer border-none bg-[#f5f5f5] text-[#333] text-lg outline-none"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-[14px] text-[#111]">{quantity}</span>
                          <button
                            onClick={() => setQuantity(Math.min(selectedTicket.remainStock, quantity + 1))}
                            className="w-8 h-8 flex items-center justify-center cursor-pointer border-none bg-[#f5f5f5] text-[#333] text-lg outline-none"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-[14px] text-[#666] ml-4">
                          合计：<span className="text-[24px] text-[#ff1268] font-medium">¥{(selectedTicket.price * quantity).toFixed(2)}</span>
                        </div>
                        <button
                          onClick={handleBuy}
                          disabled={Boolean(showsSeatCraftSelection) && validSelectedSeatIds.length !== quantity}
                          className="ml-auto cursor-pointer border-none outline-none text-white text-[16px] font-medium px-10 py-3 rounded disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: '#ff1268' }}
                        >
                          立即购买
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
                </>
              )}
            </div>
            </div>

            {/* 下方：项目详情 */}
            <div className="bg-white rounded-lg overflow-hidden border border-[#e5e5e5]">
            {/* 标签栏 */}
            <div className="flex items-center px-6 border-b border-[#e5e5e5]">
              <div className="py-4 px-2 text-[#ff1268] font-medium border-b-2 border-[#ff1268] cursor-pointer text-[15px] mr-10">项目详情</div>
              <div className="py-4 px-2 text-[#333] hover:text-[#ff1268] cursor-pointer transition-colors text-[15px] mr-10">购票须知</div>
              <div className="py-4 px-2 text-[#333] hover:text-[#ff1268] cursor-pointer transition-colors text-[15px]">观演须知</div>
            </div>
            
            {/* 详情内容 */}
            <div className="p-8">
              <h2 className="text-[18px] font-medium text-[#111] mb-6">演出介绍</h2>
              {/* 模拟详情大图 */}
              <div className="w-full bg-[#f8f8f8] p-10 flex flex-col items-center justify-center rounded-lg border border-[#eee]">
                <h3 className="text-2xl font-bold text-[#ff1268] mb-4">人、票、证信息不匹配 无法入场</h3>
                <p className="text-[#333] text-center max-w-[600px] leading-relaxed">
                  根据文化和旅游部公安部联合下发的《关于进一步加强大型营业性演出活动规范管理促进演出市场健康有序发展的通知》（文旅市场发[2023]96号）要求：<br/>
                  <strong>购票人需与入场观演人身份信息保持一致。</strong>
                  观演人入场时需提供与电子票信息一致的身份证原件，并进行人脸识别验证与安检。
                </p>
                <div className="mt-10 p-4 border border-[#e5e5e5] rounded flex items-center gap-4 bg-white">
                  <div className="w-24 h-24 bg-gray-200">
                    <img src="/1.png" alt="QR Code mock" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold mb-1">万象APP扫码购票</div>
                    <div className="text-sm text-gray-500">该渠道不支持购买</div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：占比约 1/3 */}
          <div className="w-[300px] flex-shrink-0 flex flex-col gap-5">
            {/* 购票保障 / 服务说明 */}
            <div className="bg-white rounded-lg p-5 border border-[#e5e5e5] text-[#666] text-[12px] space-y-4">
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">x</span>
                  不支持退
                </div>
                <div className="leading-relaxed">票品为有价票券，非普通商品，其背后承载的文化服务具有时效性，稀缺性等特征，不支持退换。</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">v</span>
                  可选座
                </div>
                <div className="leading-relaxed">本项目支持自主选座<br/>1.选择演出时间，并点击“选座购票”进入选座页面<br/>2.选座后，在确认订单页支付成功，则选座生效</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">v</span>
                  自助换票
                </div>
                <div className="leading-relaxed">需要您在指定的取票地点取票，下单后可通过票夹中的二维码或身份证换取纸质票</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">v</span>
                  电子发票
                </div>
                <div className="leading-relaxed">发票开具方：万象票务<br/>本项目支持开具电子发票。需要在演出开始前在订单详情页提交发票申请，一般演出结束后1个月左右开具并发送至您的邮箱。</div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#e5e5e5] flex items-center gap-4">
                <div className="flex-1 text-center">
                  <div className="text-[14px] text-[#333] mb-1">手机扫一扫</div>
                  <div className="text-[#999]">下单更快捷</div>
                </div>
                <div className="w-[80px] h-[80px] bg-gray-100 flex-shrink-0">
                  <img src="/1.png" alt="QR code" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            {/* 为你推荐 */}
            <div className="bg-white rounded-lg p-5 border border-[#e5e5e5]">
              <h2 className="text-[16px] font-medium text-[#111] mb-5">为你推荐</h2>
              <div className="space-y-6">
                {[
                  { id: '1', title: '2026 BY2「撇清关系2.0」演唱会', time: '2026.05.23', price: 380, poster: 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN011T4dOK2GdSmT2mxkU_!!2251059038.jpg' },
                  { id: '2', title: '2026胡夏【那些年】北京站', time: '2026.05.16', price: 480, poster: 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01zi0EBO2GdSmFU9a0X_!!2251059038.jpg' },
                  { id: '3', title: '民谣30年·不如一见演唱会', time: '2026.06.01', price: 180, poster: 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01wwbQzO2GdSmONJqqn_!!2251059038.png' }
                ].map(item => (
                  <div key={item.id} className="flex gap-3 cursor-pointer group">
                    <div className="w-[80px] h-[106px] flex-shrink-0 rounded overflow-hidden">
                      <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="text-[14px] text-[#333] font-medium line-clamp-2 leading-snug group-hover:text-[#ff1268] transition-colors">{item.title}</div>
                      <div className="text-[12px] text-[#999] mt-2">{item.time}</div>
                      <div className="mt-auto text-[#ff1268] text-[16px] font-medium">¥{item.price}<span className="text-[12px]">起</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {(() => {
        const modals = (
          <>
            {/* 订单确认弹窗 */}
            {showConfirm && selectedSession && selectedTicket && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowConfirm(false)}
              >
                <div
                  className="bg-white rounded-lg p-6"
                  style={{ width: 420 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-[18px] text-[#111] font-medium mb-4">确认订单</h3>

                  <div className="text-[14px] text-[#333] space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#999]">活动</span>
                      <span className="text-right flex-1 ml-4">{activity.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#999]">场次</span>
                      <span>{selectedSession.session.startTime?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#999]">场馆</span>
                      <span>{selectedSession.venue?.name}{selectedSession.venue?.city ? ` - ${selectedSession.venue.city}` : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#999]">票档</span>
                      <span>{selectedTicket.name} × {quantity}张</span>
                    </div>
                    {showsSeatCraftSelection && validSelectedSeatIds.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#999]">座位</span>
                        <div className="text-right flex-1 ml-4 text-[13px] leading-relaxed">
                          {validSelectedSeatIds.map(id => {
                            const seat = seatMap?.seats.find(s => s.id === id)
                            if (!seat) return ''
                            const sectionName = seatMap?.layout?.sections.find(s => s.id === seat.layoutSectionId)?.name || seat.areaId || ''
                            return `${sectionName ? sectionName + ' ' : ''}${seat.rowNo}排${seat.seatNo}座`
                          }).join('，')}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between text-[16px] font-medium pt-3 border-t border-[#f0f0f0]">
                      <span>合计</span>
                      <span className="text-[#ff1268]">¥{(selectedTicket.price * quantity).toFixed(2)}</span>
                    </div>
                  </div>

                  {orderError && (
                    <div className="mb-4 p-2.5 bg-[#fff0f0] border border-[#ffcccc] rounded text-[#e74c3c] text-[13px]">
                      {orderError}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={ordering}
                      className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmOrder}
                      disabled={ordering}
                      className="cursor-pointer border-none outline-none text-white text-[14px] px-6 py-2 rounded"
                      style={{ backgroundColor: '#ff1268', opacity: ordering ? 0.7 : 1 }}
                    >
                      {ordering ? '提交中...' : '确认支付'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 支付成功弹窗 */}
            {showSuccess && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center" style={{ width: 360 }}>
                  {/* 成功图标 */}
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#f6ffed', border: '2px solid #52c41a' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#52c41a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 className="text-[20px] font-medium text-[#111] mb-2">支付成功</h3>
                  <p className="text-[13px] text-[#999] mb-1">订单号</p>
                  <p className="text-[14px] text-[#333] font-medium mb-6">{successOrderNo}</p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setShowSuccess(false)}
                      className="flex-1 cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] py-2.5 rounded-lg outline-none"
                    >
                      继续浏览
                    </button>
                    <button
                      onClick={() => router.push('/orders')}
                      className="flex-1 cursor-pointer border-none outline-none text-white text-[14px] py-2.5 rounded-lg"
                      style={{ backgroundColor: '#ff1268' }}
                    >
                      查看订单
                    </button>
                  </div>
                </div>
              </div>
            )}

            {qrPay && (
              <AlipayQrPayModal
                pay={qrPay}
                productName={activity.name}
                onClose={() => setQrPay(null)}
                onPaid={(result) => {
                  setSuccessOrderNo(result.orderNo || qrPay.orderNo)
                  setQrPay(null)
                  setShowSuccess(true)
                }}
              />
            )}
          </>
        )
        return modals
      })()}
    </>
  )
}
