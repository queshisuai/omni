'use client'

import { useState, useEffect, use, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, Heart, MessageCircle, Star, UserRound } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SeatCraftSelector } from '@/components/seatcraft-unified/SeatCraftSelector'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import { globalAlert, globalConfirm, globalPrompt } from '@/components/GlobalDialog'
import { cancelGrabRequest, createActivityQuestion, createActivityReview, createAlipayQrPay, createSubscription, createSubscriptionCalendar, createTeamGrab, createUserAttendee, createWaitlistEntry, deleteUserAttendee, getActivityDetail, getGrabProgress, getGrabVisibleStock, getSeatMap, joinTeamGrab, listActivityQuestions, listActivityReviews, listUserAttendees, submitGrabRequest } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { buildGrabIdempotencyIntent, buildSeatAllocationPayload, canShowPurchaseEntry, canShowWaitlistEntry, getPurchaseConfirmCopy, getPurchaseQuantityMax, getWaitlistQuantityMax, shouldResetGrabIdempotencyForStatus, type PurchaseConfirmMode } from '@/lib/purchase-intent'
import { getCountdownText } from '@/lib/subscription'
import { buildZoomTargetFromTicketGroup, toSeatCraftSelectionModel } from '@/components/seatcraft-unified/adapters'
import { defaultTeamFallbacks } from '@/lib/team-grab'
import { getAutoDowngradeDisplay, getGrabProgressDisplayMessage, getQueueRankTrendLabel, localizeGrabProgressMessage } from '@/lib/grab-progress'
import { canJoinWaitlistFromGrabStatus } from '@/lib/waitlist'
import { formatAttendeeSummary, getAttendeeIdTypeLabel, normalizeChineseIdCard, removeAttendeeById, validateAttendeeSelection } from '@/lib/attendees'
import { ACTIVITY_VIEW_SIGNAL_KEY, addActivityViewSignal, parseActivityViewSignals } from '@/lib/personalized-recommendations'
import type { ActivityDetailVO, ActivityQuestionVO, ActivityReviewListVO, GrabProgressResult, QrPayResponse, SeatMapResponse, SessionDetail, SessionSeatVO, SessionVisibleStockResult, TicketTypeEntity, UserAttendeeVO } from '@/types/api'

const TERMINAL_GRAB_STATUSES = new Set(['ORDER_CREATED', 'SOLD_OUT', 'LIMITED', 'FAILED', 'PENDING_RECOVERY', 'EXPIRED'])
const GRAB_STATUS_LABELS: Record<string, string> = {
  QUEUED: '排队中',
  WAITING: '等待处理',
  TRYING_TICKET_TYPE: '正在尝试票档',
  LOCKING: '正在锁票',
  ORDER_CREATING: '正在生成订单',
  ORDER_CREATED: '已生成订单',
  SOLD_OUT: '已售罄',
  DOWNGRADING: '正在尝试后续票档',
  PENDING_RECOVERY: '订单确认中',
  FAILED: '抢票失败',
  LIMITED: '限购失败',
  EXPIRED: '已结束',
}
const GRAB_ATTEMPT_STATUS_LABELS: Record<string, string> = {
  PENDING: '待尝试',
  TRYING: '正在尝试',
  LOCKING: '正在锁票',
  ORDER_CREATED: '已生成订单',
  SOLD_OUT: '已售罄',
  FAILED: '抢票失败',
  LIMITED: '限购失败',
}

function artistSummaryFromDetail(detail: ActivityDetailVO) {
  return detail.artists?.length
    ? detail.artists.map(item => item.name).filter(Boolean).join('、')
    : detail.artist?.name || ''
}

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
  const [confirmMode, setConfirmMode] = useState<PurchaseConfirmMode>('purchase')
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successOrderNo, setSuccessOrderNo] = useState('')
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [seatMapLoading, setSeatMapLoading] = useState(false)
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [grabIdempotency, setGrabIdempotency] = useState<{ intent: string; key: string } | null>(null)
  const [allowAutoDowngrade, setAllowAutoDowngrade] = useState(false)
  const [grabProgress, setGrabProgress] = useState<GrabProgressResult | null>(null)
  const [grabProgressOpen, setGrabProgressOpen] = useState(false)
  const [progressPaymentOpening, setProgressPaymentOpening] = useState(false)
  const [teamActionLoading, setTeamActionLoading] = useState(false)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState('')
  const [subscriptionLoading, setSubscriptionLoading] = useState<string | null>(null)
  const [visibleStock, setVisibleStock] = useState<SessionVisibleStockResult | null>(null)
  const [attendees, setAttendees] = useState<UserAttendeeVO[]>([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)
  const [attendeeError, setAttendeeError] = useState('')
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<number[]>([])
  const [attendeeSaving, setAttendeeSaving] = useState(false)
  const [attendeeDeletingId, setAttendeeDeletingId] = useState<number | null>(null)
  const [attendeeForm, setAttendeeForm] = useState({ realName: '', idNo: '', phone: '' })
  const [reviewData, setReviewData] = useState<ActivityReviewListVO | null>(null)
  const [questions, setQuestions] = useState<ActivityQuestionVO[]>([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '', images: '' })
  const [questionContent, setQuestionContent] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [questionSubmitting, setQuestionSubmitting] = useState(false)
  const seatMapRequestIdRef = useRef(0)
  const progressPaymentOrderIdRef = useRef<number | null>(null)
  const progressPaymentInFlightOrderIdRef = useRef<number | null>(null)
  const hydratedGrabRequestRef = useRef<string | null>(null)
  const loadDetailRef = useRef(() => {})
  const lastRefreshRef = useRef(0)

  const seatCraftSelectionModel = useMemo(() => seatMap ? toSeatCraftSelectionModel(seatMap) : null, [seatMap])
  const seatCraftFocusTarget = useMemo(() => {
    if (!seatMap?.layout || selectedTicket?.id == null) return null
    return buildZoomTargetFromTicketGroup(seatMap.layout, selectedTicket.id)
  }, [seatMap?.layout, selectedTicket?.id])
  const showsSeatCraftSelection = Boolean(seatMap?.layout && (seatMap.layout.blockLayout?.blocks?.length || seatMap.layout.blocks?.length) && seatCraftSelectionModel)
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
  const buildTicketTypePreferences = () => {
    if (!selectedSession || !selectedTicket) return []
    const sorted = selectedSession.ticketTypes
      .filter(ticket => ticket.id === selectedTicket.id || (allowAutoDowngrade && !showsSeatCraftSelection && ticket.price <= selectedTicket.price))
      .sort((a, b) => {
        if (a.id === selectedTicket.id) return -1
        if (b.id === selectedTicket.id) return 1
        return b.price - a.price
      })
    return sorted.map(ticket => ({ ticketTypeId: ticket.id, name: ticket.name, maxPrice: ticket.price }))
  }
  const downgradeCandidates = selectedSession && selectedTicket && !showsSeatCraftSelection
    ? selectedSession.ticketTypes
      .filter(ticket => ticket.id !== selectedTicket.id && ticket.price <= selectedTicket.price)
      .sort((a, b) => b.price - a.price)
    : []
  const currentProgressStock = grabProgress?.currentTicketTypeId != null && visibleStock
    ? visibleStock.ticketTypes.find(ticket => ticket.ticketTypeId === grabProgress.currentTicketTypeId)
    : null
  const realNameRequired = Boolean(detail?.activity.realNameRequired)
  const selectedAttendeeSummary = useMemo(
    () => formatAttendeeSummary(attendees, selectedAttendeeIds),
    [attendees, selectedAttendeeIds],
  )
  const selectedTicketVisibleStock = selectedTicket && visibleStock
    ? visibleStock.ticketTypes.find(ticket => ticket.ticketTypeId === selectedTicket.id)
    : null
  const showPurchaseEntry = canShowPurchaseEntry({
    ticket: selectedTicket,
    visibleStock: selectedTicketVisibleStock,
  })
  const showWaitlistEntry = canShowWaitlistEntry({
    ticket: selectedTicket,
    visibleStock: selectedTicketVisibleStock,
  })
  const purchaseQuantityMax = getPurchaseQuantityMax({
    ticket: selectedTicket,
    visibleStock: selectedTicketVisibleStock,
  })
  const waitlistQuantityMax = getWaitlistQuantityMax(detail?.activity.perUserLimit)
  const actionQuantityMax = showWaitlistEntry ? waitlistQuantityMax : purchaseQuantityMax
  const confirmCopy = getPurchaseConfirmCopy(confirmMode)
  const confirmSubmitting = confirmMode === 'waitlist' ? waitlistSubmitting : ordering
  const getActiveGrabStorageKey = () => {
    const user = getUser()
    return user ? `grab:active-request:${user.userId}:${id}` : null
  }
  const rememberActiveGrabRequest = (requestId: string) => {
    const key = getActiveGrabStorageKey()
    if (key) window.localStorage.setItem(key, requestId)
  }
  const forgetActiveGrabRequest = () => {
    const key = getActiveGrabStorageKey()
    if (key) window.localStorage.removeItem(key)
  }

  const loadDetail = async () => {
    setLoading(true)
    setError('')
    setSelectedSession(null)
    setSelectedTicket(null)
    setAllowAutoDowngrade(false)
    try {
      const data = await getActivityDetail(Number(id))
      setDetail(data)
      if (typeof window !== 'undefined') {
        const firstVenue = data.sessions[0]?.venue?.city || ''
        const next = addActivityViewSignal(parseActivityViewSignals(localStorage.getItem(ACTIVITY_VIEW_SIGNAL_KEY)), {
          activityId: String(data.activity.id),
          category: data.category?.name || null,
          artist: artistSummaryFromDetail(data) || null,
          city: firstVenue || null,
        })
        localStorage.setItem(ACTIVITY_VIEW_SIGNAL_KEY, JSON.stringify(next))
      }
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

  useEffect(() => {
    void loadDetail()
  }, [id])

  const loadReviewsAndQuestions = async () => {
    const activityId = Number(id)
    try {
      const [reviews, questionList] = await Promise.all([
        listActivityReviews(activityId),
        listActivityQuestions(activityId),
      ])
      setReviewData(reviews)
      setQuestions(questionList)
    } catch {
      setReviewData(null)
      setQuestions([])
    }
  }

  useEffect(() => {
    void loadReviewsAndQuestions()
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

  useEffect(() => {
    if (!selectedSession?.ticketTypes.length) {
      setVisibleStock(null)
      return
    }

    let cancelled = false
    const ids = selectedSession.ticketTypes.map(ticket => ticket.id)
    getGrabVisibleStock(selectedSession.session.id, ids)
      .then((stock) => {
        if (!cancelled) setVisibleStock(stock)
      })
      .catch(() => {
        if (!cancelled) setVisibleStock(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedSession])

  useEffect(() => {
    if (!grabProgressOpen || !grabProgress?.requestId || TERMINAL_GRAB_STATUSES.has(grabProgress.status)) return

    let cancelled = false
    const fetchProgress = () => {
      getGrabProgress(grabProgress.requestId)
        .then((progress) => {
          if (!cancelled) {
            setGrabProgress((prev) => ({
              ...progress,
              queueRankPrevious: prev?.queueRank ?? null,
            }))
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setOrderError(err instanceof Error ? err.message : '抢票进度查询失败')
        })
    }

    const timer = window.setInterval(fetchProgress, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [grabProgressOpen, grabProgress?.requestId, grabProgress?.status])

  const resetGrabIdempotencyKey = () => setGrabIdempotency(null)

  const openProgressPayment = async (orderId: number) => {
    if (progressPaymentOrderIdRef.current === orderId || progressPaymentInFlightOrderIdRef.current === orderId) return

    progressPaymentInFlightOrderIdRef.current = orderId
    setProgressPaymentOpening(true)
    setOrderError('')
    try {
      const pay = await createAlipayQrPay(orderId)
      progressPaymentOrderIdRef.current = orderId
      setQrPay(pay)
      setGrabProgressOpen(false)
      setShowConfirm(false)
      resetGrabIdempotencyKey()
      forgetActiveGrabRequest()
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : '支付创建失败')
    } finally {
      progressPaymentInFlightOrderIdRef.current = null
      setProgressPaymentOpening(false)
    }
  }

  const goToOrdersFromProgress = () => {
    forgetActiveGrabRequest()
    router.push('/orders')
  }

  useEffect(() => {
    if (!grabProgressOpen || grabProgress?.status !== 'ORDER_CREATED' || !grabProgress.orderId) return

    void openProgressPayment(grabProgress.orderId)
  }, [grabProgressOpen, grabProgress?.status, grabProgress?.orderId])

  useEffect(() => {
    if (showsSeatCraftSelection && allowAutoDowngrade) {
      setAllowAutoDowngrade(false)
    }
  }, [showsSeatCraftSelection, allowAutoDowngrade])

  useEffect(() => {
    if (quantity <= actionQuantityMax) return
    setQuantity(actionQuantityMax)
    setSelectedSeatIds(ids => ids.slice(0, actionQuantityMax))
    setSelectedAttendeeIds(ids => ids.slice(0, actionQuantityMax))
    resetGrabIdempotencyKey()
  }, [actionQuantityMax, quantity])

  useEffect(() => {
    setSelectedAttendeeIds(ids => ids.slice(0, quantity))
    resetGrabIdempotencyKey()
  }, [quantity])

  useEffect(() => {
    if (!realNameRequired || !isAuthenticated()) {
      setAttendees([])
      setSelectedAttendeeIds([])
      setAttendeesLoading(false)
      return
    }

    let cancelled = false
    setAttendeesLoading(true)
    setAttendeeError('')
    listUserAttendees()
      .then((data) => {
        if (cancelled) return
        setAttendees(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAttendeeError(err instanceof Error ? err.message : '实名观演人加载失败')
      })
      .finally(() => {
        if (!cancelled) setAttendeesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [realNameRequired])

  useEffect(() => {
    const available = new Set(attendees.map(attendee => attendee.id))
    setSelectedAttendeeIds(ids => ids.filter(id => available.has(id)).slice(0, quantity))
  }, [attendees, quantity])

  useEffect(() => {
    if (!detail || grabProgress?.requestId) return
    const key = getActiveGrabStorageKey()
    const requestId = key ? window.localStorage.getItem(key) : null
    if (!requestId || hydratedGrabRequestRef.current === requestId) return

    hydratedGrabRequestRef.current = requestId
    getGrabProgress(requestId)
      .then((progress) => {
        const belongsToActivity = detail.sessions.some((session) => session.session.id === progress.sessionId)
        if (!belongsToActivity) {
          forgetActiveGrabRequest()
          return
        }
        setGrabProgress(progress)
        setGrabProgressOpen(true)
      })
      .catch(() => {
        forgetActiveGrabRequest()
      })
  }, [detail, grabProgress?.requestId])

  useEffect(() => {
    if (!grabProgress?.requestId) return
    if (shouldResetGrabIdempotencyForStatus(grabProgress.status)) {
      forgetActiveGrabRequest()
      resetGrabIdempotencyKey()
      return
    }
    rememberActiveGrabRequest(grabProgress.requestId)
  }, [grabProgress?.requestId, grabProgress?.status])

  const handleBuy = () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    if (!selectedTicket) return
    setOrderError('')
    setWaitlistMessage('')
    setConfirmMode('purchase')
    setRefundPolicyAccepted(false)
    setShowConfirm(true)
  }

  const handleWaitlistEntry = () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    if (!selectedTicket) return
    setOrderError('')
    setWaitlistMessage('')
    setConfirmMode('waitlist')
    setRefundPolicyAccepted(true)
    setShowConfirm(true)
  }

  const closeConfirmDialog = () => {
    if (ordering || waitlistSubmitting) return
    setShowConfirm(false)
    setConfirmMode('purchase')
    setRefundPolicyAccepted(false)
    resetGrabIdempotencyKey()
  }

  const ensureTeamSelection = () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return false
    }
    if (!selectedSession || !selectedTicket) {
      void globalAlert('请先选择场次和票档')
      return false
    }
    return true
  }

  const handleCreateTeam = async () => {
    if (!ensureTeamSelection() || !selectedSession || !selectedTicket) return

    setTeamActionLoading(true)
    try {
      const team = await createTeamGrab({
        activityId: detail?.activity.id ?? Number(id),
        sessionId: selectedSession.session.id,
        ticketTypeId: selectedTicket.id,
        strategy: 'STRICT_CONTIGUOUS',
        fallbacks: defaultTeamFallbacks('STRICT_CONTIGUOUS'),
      })
      router.push(`/teams/${team.id}`)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '创建小队失败')
    } finally {
      setTeamActionLoading(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }

    const input = await globalPrompt('请输入小队 ID', '加入已有小队', '小队 ID')
    const value = input?.trim()
    if (!value) return
    if (!/^\d+$/.test(value)) {
      await globalAlert('小队 ID 必须是正整数')
      return
    }

    const teamId = Number(value)
    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      await globalAlert('小队 ID 必须是正整数')
      return
    }

    const inviteCodeInput = await globalPrompt('请输入小队邀请码', '加入已有小队', '邀请码')
    const inviteCode = inviteCodeInput?.trim()
    if (!inviteCode) {
      await globalAlert('请输入小队邀请码')
      return
    }

    setTeamActionLoading(true)
    try {
      const team = await joinTeamGrab(teamId, inviteCode)
      router.push(`/teams/${team.id}`)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加入小队失败')
    } finally {
      setTeamActionLoading(false)
    }
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
            resetGrabIdempotencyKey()
            return
          }
        }
      }
    }
    setSelectedSeatIds(available.slice(0, quantity).map(seat => seat.id))
    resetGrabIdempotencyKey()
  }

  const buildGrabIntent = (userId: number) => {
    const allocation = buildSeatAllocationPayload({
      ticket: selectedTicket,
      seatSelectionVisible: showsSeatCraftSelection,
      selectedSeatIds: validSelectedSeatIds,
    })
    const ticketTypePreferences = buildTicketTypePreferences()
    return buildGrabIdempotencyIntent({
      userId,
      sessionId: selectedSession?.session.id ?? 0,
      selectedTicketId: selectedTicket?.id ?? 0,
      quantity,
      seatIds: allocation.seatIds,
      attendeeIds: realNameRequired ? selectedAttendeeIds : [],
      allocateRandom: allocation.allocateRandom,
      allowAutoDowngrade: allowAutoDowngrade && !showsSeatCraftSelection,
      ticketTypePreferences,
    })
  }

  const getOrCreateGrabIdempotencyKey = (userId: number) => {
    const intent = buildGrabIntent(userId)
    if (grabIdempotency?.intent === intent) return grabIdempotency.key
    const key = `${intent}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    setGrabIdempotency({ intent, key })
    return key
  }

  const toggleAttendeeSelection = (attendeeId: number) => {
    setSelectedAttendeeIds(current => {
      if (current.includes(attendeeId)) return current.filter(id => id !== attendeeId)
      if (current.length >= quantity) return current
      return [...current, attendeeId]
    })
    resetGrabIdempotencyKey()
  }

  const handleCreateAttendee = async () => {
    const realName = attendeeForm.realName.trim()
    const idNo = normalizeChineseIdCard(attendeeForm.idNo)
    const phone = attendeeForm.phone.trim()
    if (!realName || !idNo) {
      setAttendeeError('请填写观演人姓名和证件号')
      return
    }

    setAttendeeSaving(true)
    setAttendeeError('')
    try {
      const created = await createUserAttendee({
        realName,
        idType: 'ID_CARD',
        idNo,
        phone: phone || null,
      })
      setAttendees(current => [created, ...current.filter(attendee => attendee.id !== created.id)])
      setSelectedAttendeeIds(current => (
        current.includes(created.id) || current.length >= quantity
          ? current
          : [...current, created.id]
      ))
      setAttendeeForm({ realName: '', idNo: '', phone: '' })
      resetGrabIdempotencyKey()
    } catch (err: unknown) {
      setAttendeeError(err instanceof Error ? err.message : '新增实名观演人失败')
    } finally {
      setAttendeeSaving(false)
    }
  }

  const handleDeleteAttendee = async (attendee: UserAttendeeVO) => {
    const confirmed = await globalConfirm(`确认删除实名观演人“${attendee.realName}”？删除后不会影响已生成订单。`, '删除实名观演人')
    if (!confirmed) return

    setAttendeeDeletingId(attendee.id)
    setAttendeeError('')
    try {
      await deleteUserAttendee(attendee.id)
      setAttendees(current => removeAttendeeById(current, [], attendee.id).attendees)
      setSelectedAttendeeIds(current => removeAttendeeById([], current, attendee.id).selectedAttendeeIds)
      resetGrabIdempotencyKey()
    } catch (err: unknown) {
      setAttendeeError(err instanceof Error ? err.message : '删除实名观演人失败')
    } finally {
      setAttendeeDeletingId(null)
    }
  }

  const handleConfirmOrder = async () => {
    if (!selectedSession || !selectedTicket) return
    const user = getUser()
    if (!user) { router.push(`/login?ru=/activity/${id}`); return }

    setOrdering(true)
    setOrderError('')
    setWaitlistMessage('')
    try {
      const allocation = buildSeatAllocationPayload({
        ticket: selectedTicket,
        seatSelectionVisible: showsSeatCraftSelection,
        selectedSeatIds: validSelectedSeatIds,
      })
      if (showsSeatCraftSelection && validSelectedSeatIds.length !== quantity) {
        setOrderError('请选择对应数量的座位')
        return
      }
      const attendeeValidation = validateAttendeeSelection(realNameRequired, selectedAttendeeIds, quantity)
      if (attendeeValidation) {
        setOrderError(attendeeValidation)
        return
      }
      const idempotencyKey = getOrCreateGrabIdempotencyKey(user.userId)
      const ticketTypePreferences = buildTicketTypePreferences()
      const grab = await submitGrabRequest({
        sessionId: selectedSession.session.id,
        ticketTypeId: selectedTicket.id,
        ticketTypePreferences,
        allowAutoDowngrade: allowAutoDowngrade && !showsSeatCraftSelection,
        seatIds: allocation.seatIds,
        attendeeIds: realNameRequired ? selectedAttendeeIds : undefined,
        quantity,
        allocateRandom: allocation.allocateRandom,
        idempotencyKey,
      })
      setGrabProgress({
        ...grab,
        sessionId: selectedSession.session.id,
        queueSeq: grab.queueSeq ?? null,
        queueRank: grab.queueRank ?? null,
        estimatedWaitSeconds: grab.estimatedWaitSeconds ?? null,
        currentTicketTypeId: selectedTicket.id,
        currentAttemptIndex: 0,
        requestedTicketTypes: ticketTypePreferences.map(ticket => ({
          ticketTypeId: ticket.ticketTypeId,
          name: ticket.name ?? null,
          maxPrice: ticket.maxPrice ?? null,
        })),
        allowAutoDowngrade: allowAutoDowngrade && !showsSeatCraftSelection,
        attempts: ticketTypePreferences.map((ticket, index) => ({
          ticketTypeId: ticket.ticketTypeId,
          name: ticket.name ?? null,
          status: index === 0 && grab.status !== 'QUEUED' ? 'TRYING' : 'PENDING',
          message: index === 0 ? `等待尝试 ${ticket.name ?? `票档 ${ticket.ticketTypeId}`}` : '待尝试',
        })),
        visibleStock: null,
        fairnessNotes: [
          '同一账号相同购票意图会复用已有排队请求，避免重复挤占队列。',
          '活动限购规则会在锁票和创建订单阶段校验。',
          '异常高频请求会触发风控拦截，请使用当前页面正常刷新。',
        ],
        message: grab.message ?? null,
        matchedTicketTypeId: null,
        updateTime: new Date().toISOString(),
      })
      progressPaymentOrderIdRef.current = null
      progressPaymentInFlightOrderIdRef.current = null
      rememberActiveGrabRequest(grab.requestId)
      setGrabProgressOpen(true)
      setShowConfirm(false)
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : '下单失败，请确认已登录并重试')
    } finally {
      setOrdering(false)
    }
  }

  const handleCancelGrabProgress = async () => {
    if (!grabProgress?.requestId) return
    try {
      const cancelled = await cancelGrabRequest(grabProgress.requestId)
      setGrabProgress((prev) => prev ? {
        ...prev,
        ...cancelled,
        queueSeq: cancelled.queueSeq ?? prev.queueSeq,
        queueRank: cancelled.queueRank ?? prev.queueRank,
        estimatedWaitSeconds: cancelled.estimatedWaitSeconds ?? prev.estimatedWaitSeconds,
        message: cancelled.message ?? cancelled.failReason ?? '已取消抢票',
        updateTime: new Date().toISOString(),
      } : prev)
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : '取消抢票失败')
    }
  }

  // 加载态
  const handleJoinWaitlist = async (options: { closeConfirm?: boolean } = {}) => {
    if (!selectedSession || !selectedTicket) return
    const user = getUser()
    if (!user) { router.push(`/login?ru=/activity/${id}`); return }

    setWaitlistSubmitting(true)
    setOrderError('')
    setWaitlistMessage('')
    try {
      const attendeeValidation = validateAttendeeSelection(realNameRequired, selectedAttendeeIds, quantity)
      if (attendeeValidation) {
        setOrderError(attendeeValidation)
        return
      }
      const entry = await createWaitlistEntry({
        sessionId: selectedSession.session.id,
        ticketTypeId: selectedTicket.id,
        quantity,
        attendeeIds: realNameRequired ? selectedAttendeeIds : undefined,
      })
      setWaitlistMessage(entry.rank != null ? `已加入候补，当前约第 ${entry.rank} 位` : '已加入候补')
      if (options.closeConfirm) {
        setShowConfirm(false)
        setConfirmMode('purchase')
      }
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : '加入候补失败')
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  const handleSubscription = async (targetType: 'ACTIVITY_WANT' | 'SALE_REMINDER' | 'WAITLIST_REMINDER' | 'ARTIST_FOLLOW') => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    if (!detail) return
    if (targetType === 'ARTIST_FOLLOW' && !detail.artist?.id) {
      await globalAlert('当前活动暂无可关注艺人')
      return
    }
    setSubscriptionLoading(targetType)
    try {
      await createSubscription({
        targetType,
        targetId: targetType === 'ARTIST_FOLLOW' ? detail.artist.id : detail.activity.id,
        activityId: targetType === 'ARTIST_FOLLOW' ? null : detail.activity.id,
        artistId: detail.artist?.id ?? null,
      })
      const message = targetType === 'ACTIVITY_WANT'
        ? '已加入想看'
        : targetType === 'SALE_REMINDER'
          ? '开售提醒已开启'
          : targetType === 'WAITLIST_REMINDER'
            ? '候补提醒已开启'
            : '艺人关注已开启'
      await globalAlert(message)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubscriptionLoading(null)
    }
  }

  const handleCalendarDownload = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    setSubscriptionLoading('CALENDAR')
    try {
      await createSubscription({ targetType: 'ACTIVITY_WANT', targetId: Number(id), activityId: Number(id), artistId: detail?.artist?.id ?? null })
      const calendar = await createSubscriptionCalendar()
      const blob = new Blob([calendar.content], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = calendar.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '生成日历失败')
    } finally {
      setSubscriptionLoading(null)
    }
  }

  const handleSubmitReview = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    const content = reviewForm.content.trim()
    if (!content) {
      await globalAlert('请填写评价内容')
      return
    }
    setReviewSubmitting(true)
    try {
      await createActivityReview(Number(id), {
        rating: reviewForm.rating,
        content,
        images: reviewForm.images.trim() || null,
      })
      setReviewForm({ rating: 5, content: '', images: '' })
      await loadReviewsAndQuestions()
      await globalAlert('评价已提交')
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '提交评价失败')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleSubmitQuestion = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?ru=/activity/${id}`)
      return
    }
    const content = questionContent.trim()
    if (!content) {
      await globalAlert('请填写问题内容')
      return
    }
    setQuestionSubmitting(true)
    try {
      await createActivityQuestion(Number(id), content)
      setQuestionContent('')
      await loadReviewsAndQuestions()
      await globalAlert('问题已提交，等待主办方回复')
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '提交问题失败')
    } finally {
      setQuestionSubmitting(false)
    }
  }

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
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSubscription('ACTIVITY_WANT')}
                disabled={subscriptionLoading === 'ACTIVITY_WANT'}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ff1268] bg-[#ff1268] px-4 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Heart className="h-4 w-4" />
                {subscriptionLoading === 'ACTIVITY_WANT' ? '添加中...' : '想看'}
              </button>
              <button
                type="button"
                onClick={() => void handleSubscription('SALE_REMINDER')}
                disabled={subscriptionLoading === 'SALE_REMINDER'}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ff1268] bg-white px-4 text-[14px] font-medium text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {subscriptionLoading === 'SALE_REMINDER' ? '开启中...' : '开售提醒'}
              </button>
              <button
                type="button"
                onClick={() => void handleSubscription('WAITLIST_REMINDER')}
                disabled={subscriptionLoading === 'WAITLIST_REMINDER'}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {subscriptionLoading === 'WAITLIST_REMINDER' ? '开启中...' : '候补提醒'}
              </button>
              <button
                type="button"
                onClick={() => void handleSubscription('ARTIST_FOLLOW')}
                disabled={subscriptionLoading === 'ARTIST_FOLLOW'}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserRound className="h-4 w-4" />
                {subscriptionLoading === 'ARTIST_FOLLOW' ? '关注中...' : '关注艺人'}
              </button>
              <button
                type="button"
                onClick={() => void handleCalendarDownload()}
                disabled={subscriptionLoading === 'CALENDAR'}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarDays className="h-4 w-4" />
                {subscriptionLoading === 'CALENDAR' ? '生成中...' : '加入日历'}
              </button>
            </div>
            <div className="mt-4 rounded-lg bg-[#fafafa] px-4 py-3 text-[13px] text-[#666]">
              {selectedSession?.session.startTime ? `倒计时：${getCountdownText(selectedSession.session.startTime)}` : '倒计时：场次时间待定'}
            </div>
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
                      setAllowAutoDowngrade(false)
                      resetGrabIdempotencyKey()
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
                      selectedSession.ticketTypes.map((tt) => {
                        const stockHint = visibleStock?.ticketTypes.find(ticket => ticket.ticketTypeId === tt.id)
                        return (
                          <button
                            key={tt.id}
                            onClick={() => { setSelectedTicket(tt); setQuantity(1); setSelectedSeatIds([]); setAllowAutoDowngrade(false); resetGrabIdempotencyKey() }}
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
                              {stockHint?.visibleStock == null
                                ? '库存变化较快'
                                : stockHint.visibleStock > 0 ? `剩余约 ${stockHint.visibleStock} 张` : '当前可见库存紧张'}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                  <div className="mb-6 text-[12px] text-[#999]">库存变化较快，以锁票结果为准。</div>

                  {/* 数量选择 + 购买按钮 */}
                  {selectedTicket && showPurchaseEntry && (
                    <>
                      <div className="mb-5">
                        {seatMapPublished && seatMapLoading ? (
                          <div className="rounded-lg border border-[#e5e5e5] p-6 text-center text-[13px] text-[#999]">正在加载座位图...</div>
                        ) : seatMapPublished && showsSeatCraftSelection && seatCraftSelectionModel ? (
                          <div>
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-[14px] text-[#666]">已选 {validSelectedSeatIds.length} / {quantity} 座</div>
                              <button onClick={handleAutoSelectSeats} className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]">自动分配</button>
                            </div>
                            <SeatCraftSelector
                              selectionModel={seatCraftSelectionModel}
                              selectedSeatIds={validSelectedSeatIds}
                              onChange={(ids) => { setSelectedSeatIds(ids); resetGrabIdempotencyKey() }}
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
                            onClick={() => { setQuantity(Math.max(1, quantity - 1)); setSelectedSeatIds(ids => ids.slice(0, Math.max(1, quantity - 1))); resetGrabIdempotencyKey() }}
                            className="w-8 h-8 flex items-center justify-center cursor-pointer border-none bg-[#f5f5f5] text-[#333] text-lg outline-none"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-[14px] text-[#111]">{quantity}</span>
                          <button
                            onClick={() => { setQuantity(Math.min(purchaseQuantityMax, quantity + 1)); resetGrabIdempotencyKey() }}
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
                  {selectedTicket && showWaitlistEntry && (
                    <div className="rounded-lg border border-[#ffd6e7] bg-[#fff7fb] px-4 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-[14px] font-medium text-[#333]">当前票档暂不可购买</div>
                          <div className="mt-1 text-[12px] leading-relaxed text-[#777]">
                            可先加入候补，释放名额后系统会按顺序生成待支付订单并通知你限时付款。
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] text-[#666]">数量</span>
                            <div className="flex items-center rounded border border-[#e5e5e5] bg-white">
                              <button
                                type="button"
                                onClick={() => { setQuantity(Math.max(1, quantity - 1)); setSelectedAttendeeIds(ids => ids.slice(0, Math.max(1, quantity - 1))); resetGrabIdempotencyKey() }}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-[#f5f5f5] text-lg text-[#333] outline-none"
                              >
                                -
                              </button>
                              <span className="w-12 text-center text-[14px] text-[#111]">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => { setQuantity(Math.min(waitlistQuantityMax, quantity + 1)); resetGrabIdempotencyKey() }}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-[#f5f5f5] text-lg text-[#333] outline-none"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleWaitlistEntry}
                            disabled={waitlistSubmitting}
                            className="cursor-pointer rounded border-none bg-[#ff1268] px-8 py-3 text-[15px] font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            加入候补
                          </button>
                        </div>
                      </div>
                      {waitlistMessage && (
                        <div className="mt-3 rounded border border-[#b7eb8f] bg-[#f6ffed] p-2.5 text-[13px] text-[#389e0d]">
                          {waitlistMessage}
                        </div>
                      )}
                      {orderError && !showConfirm && (
                        <div className="mt-3 rounded border border-[#ffcccc] bg-[#fff0f0] p-2.5 text-[13px] text-[#e74c3c]">
                          {orderError}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTicket && (
                    <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-[14px] font-medium text-[#333]">小队抢票</div>
                          <div className="mt-1 text-[12px] text-[#999]">和朋友一起确认后抢票</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleCreateTeam}
                            disabled={teamActionLoading}
                            className="min-h-10 rounded border-none bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#e01058] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            创建小队
                          </button>
                          <button
                            type="button"
                            onClick={handleJoinTeam}
                            disabled={teamActionLoading}
                            className="min-h-10 rounded border border-[#ff1268] bg-white px-4 py-2 text-[14px] font-medium text-[#ff1268] outline-none transition-colors hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            加入已有小队
                          </button>
                        </div>
                      </div>
                    </div>
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
                    <img src="/1.png" alt="二维码示意图" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold mb-1">万象应用扫码购票</div>
                    <div className="text-sm text-gray-500">该渠道不支持购买</div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg overflow-hidden border border-[#e5e5e5]">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-6 py-4">
              <div>
                <h2 className="text-[18px] font-medium text-[#111]">评价与问答</h2>
                <p className="mt-1 text-[13px] text-[#999]">看真实观演反馈，购票前也可以提问</p>
              </div>
              <div className="flex items-center gap-2 text-[#ff1268]">
                <Star className="h-5 w-5 fill-[#ff1268]" />
                <span className="text-[22px] font-bold">{reviewData?.summary.averageRating ?? '0.0'}</span>
                <span className="text-[13px] text-[#999]">/ 5</span>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <section className="border-b border-[#f0f0f0] p-6 lg:border-b-0 lg:border-r">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-[16px] font-medium text-[#111]">观演评价</h3>
                  <span className="text-[13px] text-[#999]">{reviewData?.summary.reviewCount ?? 0} 条评价</span>
                </div>

                <div className="mb-5 rounded-lg bg-[#fafafa] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: value })}
                        className="text-[#ff1268]"
                        title={`${value}星`}
                      >
                        <Star className={`h-5 w-5 ${value <= reviewForm.rating ? 'fill-[#ff1268]' : ''}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewForm.content}
                    onChange={event => setReviewForm({ ...reviewForm, content: event.target.value })}
                    placeholder="写下观演体验、入场动线、座位视野等感受"
                    className="mb-3 h-20 w-full resize-none rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px] outline-none focus:border-[#ff1268]"
                  />
                  <input
                    value={reviewForm.images}
                    onChange={event => setReviewForm({ ...reviewForm, images: event.target.value })}
                    placeholder="图片地址，可选，多个用英文逗号分隔"
                    className="mb-3 h-9 w-full rounded-lg border border-[#e5e5e5] px-3 text-[13px] outline-none focus:border-[#ff1268]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitReview()}
                    disabled={reviewSubmitting}
                    className="rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
                  >
                    {reviewSubmitting ? '提交中...' : '提交评价'}
                  </button>
                </div>

                <div className="space-y-4">
                  {(reviewData?.reviews || []).slice(0, 5).map(item => (
                    <div key={item.id || `${item.userId}-${item.content}`} className="rounded-lg border border-[#f0f0f0] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[#ff1268]">
                          {Array.from({ length: item.rating }).map((_, index) => <Star key={index} className="h-3.5 w-3.5 fill-[#ff1268]" />)}
                        </div>
                        <span className="text-[12px] text-[#aaa]">用户 {item.userId}</span>
                      </div>
                      <p className="text-[13px] leading-6 text-[#555]">{item.content || '用户未填写文字评价'}</p>
                      {item.images && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.images.split(',').map(url => url.trim()).filter(Boolean).slice(0, 3).map(url => (
                            <img key={url} src={url} alt="评价图片" className="h-16 w-16 rounded object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!reviewData || reviewData.reviews.length === 0) && (
                    <div className="rounded-lg bg-[#fafafa] py-8 text-center text-[13px] text-[#999]">暂无评价，购票观演后可以来分享体验</div>
                  )}
                </div>
              </section>

              <section className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-[16px] font-medium text-[#111]">问答区</h3>
                  <MessageCircle className="h-5 w-5 text-[#ff1268]" />
                </div>
                <div className="mb-5 rounded-lg bg-[#fafafa] p-4">
                  <textarea
                    value={questionContent}
                    onChange={event => setQuestionContent(event.target.value)}
                    placeholder="例如：几点检票、是否可带相机、儿童是否需购票"
                    className="mb-3 h-20 w-full resize-none rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px] outline-none focus:border-[#ff1268]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitQuestion()}
                    disabled={questionSubmitting}
                    className="rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[13px] font-medium text-[#ff1268] disabled:opacity-60"
                  >
                    {questionSubmitting ? '提交中...' : '我要提问'}
                  </button>
                </div>
                <div className="space-y-4">
                  {questions.slice(0, 6).map(item => (
                    <div key={item.id || `${item.userId}-${item.content}`} className="rounded-lg border border-[#f0f0f0] p-4">
                      <div className="mb-2 text-[13px] font-medium text-[#333]">问：{item.content}</div>
                      <div className="text-[13px] leading-6 text-[#666]">
                        答：{item.answer || (item.status === 'PENDING' ? '已提交，等待回复' : '暂无回复')}
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && (
                    <div className="rounded-lg bg-[#fafafa] py-8 text-center text-[13px] text-[#999]">暂无问答，购票前可以先提一个问题</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* 右侧：占比约 1/3 */}
          <div className="w-[300px] flex-shrink-0 flex flex-col gap-5">
            {/* 购票保障 / 服务说明 */}
            <div className="bg-white rounded-lg p-5 border border-[#e5e5e5] text-[#666] text-[12px] space-y-4">
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">×</span>
                  不支持退
                </div>
                <div className="leading-relaxed">票品为有价票券，非普通商品，其背后承载的文化服务具有时效性，稀缺性等特征，不支持退换。</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">✓</span>
                  可选座
                </div>
                <div className="leading-relaxed">本项目支持自主选座<br/>1.选择演出时间，并点击“选座购票”进入选座页面<br/>2.选座后，在确认订单页支付成功，则选座生效</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">✓</span>
                  自助换票
                </div>
                <div className="leading-relaxed">需要您在指定的取票地点取票，下单后可通过票夹中的二维码或身份证换取纸质票</div>
              </div>
              <div>
                <div className="flex items-center text-[#ff1268] font-medium mb-1 text-[13px]">
                  <span className="w-3 h-3 rounded-full border border-[#ff1268] flex items-center justify-center mr-1.5 font-bold text-[10px]">✓</span>
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
                  <img src="/1.png" alt="二维码" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-[#e5e5e5]">
              <h2 className="text-[16px] font-medium text-[#111] mb-4">抢票准备检查</h2>
              <div className="space-y-3 text-[13px] text-[#666]">
                <div className="flex items-center justify-between gap-3">
                  <span>登录状态</span>
                  <span className={isAuthenticated() ? 'text-[#16a34a]' : 'text-[#ff1268]'}>{isAuthenticated() ? '已登录' : '待登录'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>实名观演人</span>
                  <span className={realNameRequired ? 'text-[#ff1268]' : 'text-[#16a34a]'}>{realNameRequired ? '需提前维护' : '非必填'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>场次</span>
                  <span className={selectedSession ? 'text-[#16a34a]' : 'text-[#999]'}>{selectedSession ? '已选择' : '待选择'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>票档</span>
                  <span className={selectedTicket ? 'text-[#16a34a]' : 'text-[#999]'}>{selectedTicket ? '已选择' : '待选择'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/subscriptions')}
                className="mt-4 w-full rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[13px] font-medium text-[#ff1268] hover:bg-[#fff0f5]"
              >
                管理想看与提醒
              </button>
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
            {/* 订单/候补确认弹窗 */}
            {showConfirm && selectedSession && selectedTicket && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                onClick={closeConfirmDialog}
              >
                <div
                  className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-lg bg-white p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-[18px] text-[#111] font-medium mb-4">{confirmCopy.title}</h3>

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
                    {confirmMode === 'purchase' && !showsSeatCraftSelection && downgradeCandidates.length > 0 && (
                      <label className="flex items-start gap-2 rounded border border-[#f0f0f0] p-3 text-[13px] text-[#666]">
                        <input
                          type="checkbox"
                          checked={allowAutoDowngrade}
                          onChange={(event) => {
                            setAllowAutoDowngrade(event.target.checked)
                            resetGrabIdempotencyKey()
                          }}
                          className="mt-0.5"
                        />
                        <span className="leading-relaxed">
                          允许自动尝试后续低价票档：
                          {[selectedTicket, ...downgradeCandidates]
                            .map(ticket => `${ticket.name} ¥${ticket.price}`)
                            .join(' / ')}
                        </span>
                      </label>
                    )}
                    {confirmMode === 'purchase' && showsSeatCraftSelection && validSelectedSeatIds.length > 0 && (
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
                    {realNameRequired && (
                      <div className="rounded border border-[#f0f0f0] bg-[#fafafa] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-[#333]">实名观演人</span>
                          <span className="text-[12px] text-[#999]">{selectedAttendeeIds.length}/{quantity}</span>
                        </div>
                        {attendeesLoading ? (
                          <div className="py-3 text-[13px] text-[#999]">加载中...</div>
                        ) : attendees.length > 0 ? (
                          <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                            {attendees.map(attendee => {
                              const checked = selectedAttendeeIds.includes(attendee.id)
                              const disabled = !checked && selectedAttendeeIds.length >= quantity
                              return (
                                <div key={attendee.id} className={`flex items-start gap-2 rounded border bg-white p-2 text-[13px] ${checked ? 'border-[#ff1268]' : 'border-[#eee]'} ${disabled ? 'opacity-50' : ''}`}>
                                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => toggleAttendeeSelection(attendee.id)}
                                      className="mt-1"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[#333]">{attendee.realName}</span>
                                      <span className="block break-all text-[12px] text-[#999]">{getAttendeeIdTypeLabel(attendee.idType)} {attendee.idNoMask}</span>
                                    </span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAttendee(attendee)}
                                    disabled={attendeeDeletingId === attendee.id}
                                    className="shrink-0 cursor-pointer rounded border border-[#ddd] bg-white px-2 py-1 text-[12px] text-[#666] outline-none hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {attendeeDeletingId === attendee.id ? '删除中...' : '删除'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="py-2 text-[13px] text-[#999]">暂无实名观演人，请先新增。</div>
                        )}
                        {selectedAttendeeSummary && (
                          <div className="mt-2 rounded bg-white px-2 py-1.5 text-[12px] text-[#666]">
                            已选：{selectedAttendeeSummary}
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input
                            value={attendeeForm.realName}
                            onChange={(event) => setAttendeeForm(form => ({ ...form, realName: event.target.value }))}
                            placeholder="姓名"
                            className="h-9 rounded border border-[#ddd] px-3 text-[13px] outline-none focus:border-[#ff1268]"
                          />
                          <input
                            value={attendeeForm.idNo}
                            onChange={(event) => setAttendeeForm(form => ({ ...form, idNo: event.target.value }))}
                            placeholder="身份证号"
                            className="h-9 rounded border border-[#ddd] px-3 text-[13px] outline-none focus:border-[#ff1268]"
                          />
                          <input
                            value={attendeeForm.phone}
                            onChange={(event) => setAttendeeForm(form => ({ ...form, phone: event.target.value }))}
                            placeholder="手机号可选"
                            className="h-9 rounded border border-[#ddd] px-3 text-[13px] outline-none focus:border-[#ff1268]"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-[12px] text-[#999]">下单后会快照保存，入场核验以订单观演人为准。</span>
                          <button
                            type="button"
                            onClick={handleCreateAttendee}
                            disabled={attendeeSaving}
                            className="shrink-0 cursor-pointer rounded border border-[#ff1268] bg-white px-3 py-1.5 text-[12px] text-[#ff1268] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {attendeeSaving ? '保存中...' : '新增'}
                          </button>
                        </div>
                        {attendeeError && (
                          <div className="mt-2 rounded border border-[#ffcccc] bg-[#fff0f0] p-2 text-[12px] text-[#e74c3c]">
                            {attendeeError}
                          </div>
                        )}
                      </div>
                    )}
                    {confirmMode === 'waitlist' && (
                      <div className="rounded border border-[#f0f0f0] bg-[#fafafa] p-3 text-[13px] leading-relaxed text-[#666]">
                        候补成功后不会立即扣款；有名额释放时系统会生成待支付订单，请在通知时间内完成支付。
                      </div>
                    )}
                    {confirmMode === 'purchase' && (
                      <label className="flex items-start gap-2 rounded border border-[#f0f0f0] bg-[#fafafa] p-3 text-[13px] leading-relaxed text-[#666]">
                        <input
                          type="checkbox"
                          checked={refundPolicyAccepted}
                          onChange={(event) => setRefundPolicyAccepted(event.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          我已阅读退票规则：已支付订单可在订单页申请退款，退款金额以可退票数和支付渠道结果为准；改期、取消或阵容变更可选择专属原因提交。
                        </span>
                      </label>
                    )}
                    <div className="flex justify-between text-[16px] font-medium pt-3 border-t border-[#f0f0f0]">
                      <span>{confirmCopy.totalLabel}</span>
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
                      onClick={closeConfirmDialog}
                      disabled={confirmSubmitting}
                      className="cursor-pointer border border-[#ddd] bg-white text-[#666] text-[14px] px-6 py-2 rounded outline-none"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (confirmMode === 'waitlist') {
                          void handleJoinWaitlist({ closeConfirm: true })
                          return
                        }
                        void handleConfirmOrder()
                      }}
                      disabled={confirmSubmitting || (confirmMode === 'purchase' && !refundPolicyAccepted)}
                      className="cursor-pointer border-none outline-none text-white text-[14px] px-6 py-2 rounded disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#ff1268', opacity: confirmSubmitting || (confirmMode === 'purchase' && !refundPolicyAccepted) ? 0.7 : 1 }}
                    >
                      {confirmSubmitting ? confirmCopy.submittingLabel : confirmCopy.submitLabel}
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

            {grabProgressOpen && grabProgress && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center px-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                <div className="w-full max-w-[480px] rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[18px] font-medium text-[#111]">抢票进度</h3>
                      <p className="mt-1 text-[12px] text-[#999]">库存变化较快，以最终锁票结果为准。</p>
                    </div>
                    <span className="rounded-full bg-[#fff1f6] px-3 py-1 text-[12px] text-[#ff1268]">
                      {GRAB_STATUS_LABELS[grabProgress.status] || '未知状态'}
                    </span>
                  </div>

                  <div className="mb-4 rounded border border-[#f0f0f0] p-3">
                    <div className="text-[12px] text-[#999]">当前状态</div>
                    <div className="mt-1 text-[14px] text-[#333]">
                      {getGrabProgressDisplayMessage(grabProgress)}
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-[13px]">
                    <div className="rounded border border-[#f0f0f0] p-3">
                      <div className="text-[#999]">排队信息</div>
                      <div className="mt-1 text-[#333]">
                        {grabProgress.queueRank != null ? `前方 ${grabProgress.queueRank} 人` : `序号 ${grabProgress.queueSeq ?? '-'}`}
                      </div>
                      {getQueueRankTrendLabel(grabProgress.queueRank, grabProgress.queueRankPrevious) && (
                        <div className="mt-1 text-[12px] text-[#999]">
                          {getQueueRankTrendLabel(grabProgress.queueRank, grabProgress.queueRankPrevious)}
                        </div>
                      )}
                    </div>
                    <div className="rounded border border-[#f0f0f0] p-3">
                      <div className="text-[#999]">预计等待</div>
                      <div className="mt-1 text-[#333]">
                        {grabProgress.estimatedWaitSeconds != null ? `${grabProgress.estimatedWaitSeconds} 秒` : '计算中'}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 rounded border border-[#f0f0f0] p-3 text-[13px]">
                    <div className="text-[#999]">自动降档</div>
                    <div className="mt-1 text-[#333]">{getAutoDowngradeDisplay(grabProgress)}</div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-2 text-[13px] font-medium text-[#333]">档位尝试列表</div>
                    <div className="space-y-2">
                      {(grabProgress.attempts.length > 0 ? grabProgress.attempts : grabProgress.requestedTicketTypes.map(ticket => ({
                        ticketTypeId: ticket.ticketTypeId,
                        name: ticket.name,
                        status: 'PENDING',
                        message: '待尝试',
                      }))).map((attempt) => (
                        <div key={attempt.ticketTypeId} className="flex items-center justify-between rounded border border-[#f0f0f0] px-3 py-2 text-[13px]">
                          <span className="text-[#333]">{attempt.name ?? `票档 ${attempt.ticketTypeId}`}</span>
                          <span className={
                            attempt.status === 'SOLD_OUT' || attempt.status === 'FAILED' || attempt.status === 'LIMITED'
                              ? 'text-[#999]'
                              : attempt.status === 'TRYING' || attempt.status === 'LOCKING'
                                ? 'text-[#ff1268]'
                                : attempt.status === 'ORDER_CREATED'
                                  ? 'text-[#22c55e]'
                                  : 'text-[#666]'
                          }>
                            {localizeGrabProgressMessage(attempt.message) || GRAB_ATTEMPT_STATUS_LABELS[attempt.status] || '状态更新中'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5 rounded bg-[#fafafa] p-3 text-[12px] text-[#777]">
                    <div className="font-medium text-[#555]">库存提示</div>
                    <div className="mt-1">
                      {grabProgress.visibleStock?.visibleStock != null
                        ? `当前档位剩余约 ${grabProgress.visibleStock.visibleStock} 张`
                      : currentProgressStock?.visibleStock != null
                          ? `${currentProgressStock.name} 剩余约 ${currentProgressStock.visibleStock} 张`
                          : '当前档位库存变化较快'}
                    </div>
                  </div>

                  {grabProgress.fairnessNotes && grabProgress.fairnessNotes.length > 0 && (
                    <div className="mb-5 rounded bg-[#fafafa] p-3 text-[12px] text-[#777]">
                      <div className="font-medium text-[#555]">公平规则</div>
                      <ul className="mt-1 space-y-1">
                        {grabProgress.fairnessNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {orderError && (
                    <div className="mb-4 rounded border border-[#ffcccc] bg-[#fff0f0] p-2.5 text-[13px] text-[#e74c3c]">
                      {orderError}
                    </div>
                  )}
                  {waitlistMessage && (
                    <div className="mb-4 rounded border border-[#b7eb8f] bg-[#f6ffed] p-2.5 text-[13px] text-[#389e0d]">
                      {waitlistMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-3">
                    {!TERMINAL_GRAB_STATUSES.has(grabProgress.status) && (
                      <button
                        type="button"
                        onClick={handleCancelGrabProgress}
                        className="cursor-pointer rounded border border-[#ddd] bg-white px-4 py-2 text-[14px] text-[#666] outline-none"
                      >
                        取消抢票
                      </button>
                    )}
                    {grabProgress.status === 'ORDER_CREATED' && grabProgress.orderId && (
                      <>
                        <button
                          type="button"
                          onClick={() => void openProgressPayment(grabProgress.orderId!)}
                          disabled={progressPaymentOpening}
                          className="cursor-pointer rounded border-none bg-[#ff1268] px-4 py-2 text-[14px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {progressPaymentOpening ? '打开支付中...' : '重新打开支付'}
                        </button>
                        <button
                          type="button"
                          onClick={goToOrdersFromProgress}
                          className="cursor-pointer rounded border border-[#ddd] bg-white px-4 py-2 text-[14px] text-[#666] outline-none"
                        >
                          查看订单
                        </button>
                      </>
                    )}
                    {grabProgress.status === 'PENDING_RECOVERY' && (
                      <button
                        type="button"
                        onClick={goToOrdersFromProgress}
                        className="cursor-pointer rounded border border-[#ddd] bg-white px-4 py-2 text-[14px] text-[#666] outline-none"
                      >
                        查看订单
                      </button>
                    )}
                    {canJoinWaitlistFromGrabStatus(grabProgress.status) && (
                      <button
                        type="button"
                        onClick={() => void handleJoinWaitlist()}
                        disabled={waitlistSubmitting}
                        className="cursor-pointer rounded border-none bg-[#ff1268] px-4 py-2 text-[14px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {waitlistSubmitting ? '加入中...' : '加入候补'}
                      </button>
                    )}
                    {TERMINAL_GRAB_STATUSES.has(grabProgress.status) && grabProgress.status !== 'ORDER_CREATED' && (
                      <button
                        type="button"
                        onClick={() => setGrabProgressOpen(false)}
                        className="cursor-pointer rounded border border-[#ddd] bg-white px-4 py-2 text-[14px] text-[#666] outline-none"
                      >
                        关闭
                      </button>
                    )}
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
