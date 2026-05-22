/**
 * API 客户端 - fetch 封装
 */
import { getToken } from './auth'
import type { ApiResult, ChangePasswordRequest, LoginResponse, OrganizerApplicationStatus, OrganizerApplicationVO, ResetPasswordRequest, SeatMapResponse, SubjectType, UserInfo } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${name}不正确`)
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
      signal: controller.signal
    })
  } catch {
    throw new ApiError(503, '服务暂不可用，请稍后重试')
  } finally {
    clearTimeout(timeoutId)
  }

  let result: ApiResult<T>
  try {
    result = await response.json()
  } catch {
    throw new ApiError(503, '服务暂不可用，请稍后重试')
  }

  if (result.code !== 200) {
    throw new ApiError(result.code, result.message)
  }

  return result.data
}

// ========== 用户服务 ==========

export async function login(params: { loginType: string; account: string; password?: string; smsCode?: string }) {
  return request<LoginResponse>(
    '/api/user/login',
    { method: 'POST', body: JSON.stringify(params) }
  )
}

export async function register(params: { phone: string; password: string; confirmPassword: string }) {
  return request<void>('/api/user/register', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getUserInfo() {
  return request<UserInfo>('/api/user/info')
}

export async function updateProfile(params: { nickname?: string | null; email?: string | null; avatar?: string | null; organizerName?: string | null }) {
  return request<UserInfo>('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export async function changePassword(params: ChangePasswordRequest) {
  return request<void>('/api/user/password', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export async function resetPassword(params: ResetPasswordRequest) {
  return request<void>('/api/user/password/reset', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function submitOrganizerApplication(params: { organizerName: string; subjectType: SubjectType; contactName: string; contactPhone: string; contactEmail?: string | null; licenseNo?: string | null; businessScope?: string | null; description?: string | null }) {
  return request<OrganizerApplicationVO>('/api/user/organizer/applications', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getMyOrganizerApplication() {
  return request<OrganizerApplicationVO | null>('/api/user/organizer/applications/my')
}

export async function listOrganizerApplications(status?: OrganizerApplicationStatus) {
  const qs = status === undefined ? '' : `?status=${status}`
  return request<OrganizerApplicationVO[]>(`/api/user/organizer/applications/admin${qs}`)
}

export async function approveOrganizerApplication(id: number, reviewNote?: string) {
  return request<OrganizerApplicationVO>(`/api/user/organizer/applications/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  })
}

export async function rejectOrganizerApplication(id: number, reviewNote: string) {
  return request<OrganizerApplicationVO>(`/api/user/organizer/applications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  })
}

export async function sendSmsCode(phone: string) {
  return request<string>(`/api/user/send-code?phone=${encodeURIComponent(phone)}`, {
    method: 'POST',
  })
}

export { ApiError }

// ========== 票务服务 ==========

export async function listActivities(params: { page?: number; size?: number; categoryId?: number }) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.size) searchParams.set('size', String(params.size))
  if (params.categoryId) searchParams.set('categoryId', String(params.categoryId))
  const qs = searchParams.toString()
  return request<import('@/types/api').PageResult<import('@/types/api').ActivityVO>>(
    `/api/ticket/activities${qs ? `?${qs}` : ''}`
  )
}

export async function getActivityDetail(id: number) {
  return request<import('@/types/api').ActivityDetailVO>(`/api/ticket/activities/${id}`)
}

export async function getSeatMap(sessionId: number, ticketTypeId: number) {
  return request<SeatMapResponse>(`/api/ticket/sessions/${sessionId}/ticket-types/${ticketTypeId}/seats`)
}

export async function listCategories() {
  return request<import('@/types/api').CategoryVO[]>('/api/ticket/categories')
}

export async function searchAdminArtists(keyword: string) {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  const qs = params.toString()
  return request<import('@/types/api').ArtistSearchVO[]>(`/api/ticket/admin/artists/search${qs ? `?${qs}` : ''}`)
}

export async function getAdminArtist(id: number) {
  assertPositiveInteger(id, 'artistId')
  return request<import('@/types/api').ArtistEntity>(`/api/ticket/admin/artists/${id}`)
}

export async function createReservation(userId: number, sessionId: number) {
  return request<void>('/api/ticket/reservations', {
    method: 'POST',
    body: JSON.stringify({ userId, sessionId }),
  })
}

export async function listReservations(userId: number) {
  return request<import('@/types/api').ReservationEntity[]>(`/api/ticket/reservations?userId=${userId}`)
}

// ========== 订单服务 ==========

export async function createOrder(params: { userId: number; sessionId: number; ticketTypeId: number; quantity: number; unitPrice?: number }) {
  return request<{ id: number; orderNo: string; amount: number }>('/api/order/create', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function createOrderWithSeats(params: { userId: number; sessionId: number; ticketTypeId: number; seatIds?: number[]; quantity?: number; unitPrice?: number }) {
  return request<{ id: number; orderNo: string; amount: number }>('/api/order/create-with-seats', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function listOrders(userId: number) {
  return request<import('@/types/api').OrderEntity[]>(`/api/order/user/${userId}`)
}

export async function listTrashOrders(userId: number) {
  return request<import('@/types/api').OrderEntity[]>(`/api/order/user/${userId}/trash`)
}

export async function getOrderDetail(id: number) {
  return request<import('@/types/api').OrderEntity>(`/api/order/${id}`)
}

export async function cancelOrder(id: number) {
  return request<void>(`/api/order/${id}`, { method: 'DELETE' })
}

export async function hideOrder(id: number, userId: number) {
  return request<void>(`/api/order/${id}/hide?userId=${userId}`, { method: 'POST' })
}

export async function restoreOrder(id: number, userId: number) {
  return request<void>(`/api/order/${id}/restore?userId=${userId}`, { method: 'POST' })
}

export async function payOrder(id: number) {
  return request<{ payUrl: string }>(`/api/order/${id}/pay`, { method: 'POST' })
}

export async function createAlipayPagePay(orderId: number) {
  return request<import('@/types/api').PagePayResponse>('/api/payment/alipay/page-pay', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export async function createAlipayQrPay(orderId: number) {
  return request<import('@/types/api').QrPayResponse>('/api/payment/alipay/qr-pay', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export async function syncAlipayPayment(orderId: number) {
  return request<import('@/types/api').PaymentStatusResponse>(`/api/payment/alipay/sync/${orderId}`)
}

export async function applyRefund(orderId: number, reason?: string) {
  return request<import('@/types/api').RefundRequestVO>('/api/payment/refunds/apply', {
    method: 'POST',
    body: JSON.stringify({ orderId, reason }),
  })
}

export async function listMyRefunds() {
  return request<import('@/types/api').RefundRequestVO[]>('/api/payment/refunds/my')
}

export async function listAdminRefunds(status?: number) {
  const qs = status === undefined ? '' : `?status=${status}`
  return request<import('@/types/api').RefundRequestVO[]>(`/api/payment/refunds/admin${qs}`)
}

export async function approveRefund(id: number, reviewNote?: string) {
  return request<import('@/types/api').RefundRequestVO>(`/api/payment/refunds/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  })
}

export async function rejectRefund(id: number, reviewNote?: string) {
  return request<import('@/types/api').RefundRequestVO>(`/api/payment/refunds/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  })
}

export function submitPayForm(payForm: string) {
  const container = document.createElement('div')
  container.style.display = 'none'
  container.innerHTML = payForm
  document.body.appendChild(container)

  const form = container.querySelector('form')
  if (!form) {
    container.remove()
    throw new Error('支付宝支付表单无效')
  }

  form.submit()
}

// ========== B端管理接口 ==========

export async function getAdminSummary(userId: number) {
  return request<import('@/types/api').AdminSummaryVO>(`/api/ticket/admin/summary?userId=${userId}`)
}

export async function listConsoleOrders(userId: number, params: { paidOnly?: boolean } = {}) {
  const searchParams = new URLSearchParams({ userId: String(userId) })
  if (params.paidOnly !== undefined) searchParams.set('paidOnly', String(params.paidOnly))
  return request<import('@/types/api').OrderEntity[]>(`/api/ticket/admin/orders?${searchParams.toString()}`)
}

export async function listAdminTours(userId: number, params: { page?: number; size?: number } = {}) {
  const searchParams = new URLSearchParams({ userId: String(userId) })
  searchParams.set('page', String(params.page || 1))
  searchParams.set('size', String(params.size || 10))
  return request<import('@/types/api').PageResult<import('@/types/api').TourEntity>>(
    `/api/ticket/admin/tours?${searchParams.toString()}`
  )
}

export async function createTourDraft(body: Record<string, unknown>) {
  return request<import('@/types/api').TourEntity>('/api/ticket/admin/tours/draft', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function createStationDraft(tourId: number, body: Record<string, unknown>) {
  return request<import('@/types/api').StationEntity>(`/api/ticket/admin/tours/${tourId}/stations/draft`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function publishStation(stationId: number, body: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/ticket/admin/stations/${stationId}/publish`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function getTourDetail(id: number) {
  return request<import('@/types/api').TourDetailVO>(`/api/ticket/tours/${id}`)
}

export async function listAdminActivities(userId: number, params: { page?: number; size?: number; keyword?: string; status?: number } = {}) {
  const searchParams = new URLSearchParams({ userId: String(userId) })
  searchParams.set('page', String(params.page || 1))
  searchParams.set('size', String(params.size || 10))
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim())
  if (params.status !== undefined) searchParams.set('status', String(params.status))
  return request<import('@/types/api').PageResult<import('@/types/api').ActivityEntity>>(
    `/api/ticket/admin/activities?${searchParams.toString()}`
  )
}

export async function getAdminActivity(id: number, userId: number) {
  return request<import('@/types/api').ActivityEntity>(`/api/ticket/admin/activities/${id}?userId=${userId}`)
}

export async function createAdminActivity(body: Record<string, unknown>) {
  return request<import('@/types/api').ActivityEntity>('/api/ticket/admin/activities', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateAdminActivity(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').ActivityEntity>(`/api/ticket/admin/activities/${id}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function updateActivityStatus(id: number, body: Record<string, unknown>) {
  return request<void>(`/api/ticket/admin/activities/${id}/status`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deactivateActivity(id: number, body: { userId: number; confirmRefund: boolean; reason?: string }) {
  return request<import('@/types/api').RefundImpactResponse>(`/api/ticket/admin/activities/${id}/deactivate`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function deactivateOrganizer(body: import('@/types/api').DeactivateOrganizerRequest) {
  return request<import('@/types/api').RefundImpactResponse>('/api/ticket/admin/organizers/deactivate', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function deleteAdminActivity(id: number, body: { userId: number; reason: string }) {
  return request<import('@/types/api').DeleteActivityResponse>(`/api/ticket/admin/activities/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}

export async function createAdminSession(body: Record<string, unknown>) {
  return request<import('@/types/api').SessionEntity>('/api/ticket/admin/sessions', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function listAdminSessions(userId: number, params: { page?: number; size?: number; activityId?: number; venueId?: number; status?: number } = {}) {
  const searchParams = new URLSearchParams({ userId: String(userId) })
  searchParams.set('page', String(params.page || 1))
  searchParams.set('size', String(params.size || 10))
  if (params.activityId) searchParams.set('activityId', String(params.activityId))
  if (params.venueId) searchParams.set('venueId', String(params.venueId))
  if (params.status !== undefined) searchParams.set('status', String(params.status))
  return request<import('@/types/api').PageResult<import('@/types/api').SessionAdminVO>>(
    `/api/ticket/admin/sessions?${searchParams.toString()}`
  )
}

export async function updateAdminSession(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').SessionEntity>(`/api/ticket/admin/sessions/${id}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deleteAdminSession(id: number, userId: number) {
  return request<void>(`/api/ticket/admin/sessions/${id}?userId=${userId}`, { method: 'DELETE' })
}

export async function createAdminTicketType(body: import('@/types/api').AdminTicketTypeCreateRequest) {
  return request<import('@/types/api').TicketTypeEntity>('/api/ticket/admin/ticket-types', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateAdminTicketType(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').TicketTypeEntity>(`/api/ticket/admin/ticket-types/${id}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deleteAdminTicketType(id: number, userId: number) {
  return request<void>(`/api/ticket/admin/ticket-types/${id}?userId=${userId}`, { method: 'DELETE' })
}

export async function listAdminVenues(userId: number) {
  return request<import('@/types/api').VenueEntity[]>(`/api/ticket/admin/venues?userId=${userId}`)
}

export async function createAdminVenue(body: Record<string, unknown>) {
  return request<import('@/types/api').VenueEntity>('/api/ticket/admin/venues', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateAdminVenue(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').VenueEntity>(`/api/ticket/admin/venues/${id}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function createVenueArea(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').SeatTemplateResponse>(`/api/ticket/admin/venues/${id}/areas`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function listVenueAreas(id: number, userId: number) {
  return request<import('@/types/api').VenueAreaVO[]>(`/api/ticket/admin/venues/${id}/areas?userId=${userId}`)
}

export async function listVenueSeats(venueId: number, userId: number) {
  return request<import('@/types/api').VenueSeatVO[]>(`/api/ticket/admin/venues/${venueId}/seats?userId=${userId}`)
}

export async function createVenueSeat(venueId: number, body: import('@/types/api').VenueSeatRequest) {
  return request<import('@/types/api').SeatTemplateSyncResponseVO>(`/api/ticket/admin/venues/${venueId}/seats`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateVenueSeat(seatId: number, body: import('@/types/api').VenueSeatRequest) {
  return request<import('@/types/api').SeatTemplateSyncResponseVO>(`/api/ticket/admin/venue-seats/${seatId}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deleteVenueSeat(seatId: number, userId: number) {
  return request<import('@/types/api').SeatTemplateSyncResponseVO>(`/api/ticket/admin/venue-seats/${seatId}?userId=${userId}`, { method: 'DELETE' })
}

export async function getActivitySeatLayout(activityId: number, userId: number) {
  assertPositiveInteger(activityId, '活动ID')
  assertPositiveInteger(userId, '用户ID')
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/activities/${activityId}/seat-layout?userId=${userId}`)
}

export async function updateActivitySeatLayout(activityId: number, body: { userId: number; layout: import('@/types/api').SeatCraftLayoutVO }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/activities/${activityId}/seat-layout`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function getVenueDefaultLayout(venueId: number) {
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/venues/${venueId}/default-layout`)
}

export async function updateVenueDefaultLayout(venueId: number, body: { userId: number; layout: import('@/types/api').SeatCraftLayoutVO }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/venues/${venueId}/default-layout`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function listVenueSeatLayoutTemplates(venueId: number, userId: number) {
  assertPositiveInteger(venueId, '地点ID')
  assertPositiveInteger(userId, '用户ID')
  return request<import('@/types/api').SeatLayoutTemplateCandidateVO[]>(`/api/ticket/admin/venues/${venueId}/seat-layout-templates?userId=${userId}`)
}

export async function getSessionSeatLayout(sessionId: number, userId: number) {
  assertPositiveInteger(sessionId, '场次ID')
  assertPositiveInteger(userId, '用户ID')
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/sessions/${sessionId}/seat-layout?userId=${userId}`)
}

export async function updateSessionSeatLayout(sessionId: number, body: { userId: number; layout: import('@/types/api').SeatCraftLayoutVO }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/sessions/${sessionId}/seat-layout`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function updateSessionTicketBindings(sessionId: number, body: import('@/types/api').SessionTicketBindingRequest) {
  return request<void>(`/api/ticket/admin/sessions/${sessionId}/ticket-bindings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function getSessionTicketDrafts(sessionId: number, userId: number) {
  assertPositiveInteger(sessionId, '场次ID')
  assertPositiveInteger(userId, '用户ID')
  return request<import('@/types/api').SeatCraftSectionVO[]>(`/api/ticket/admin/sessions/${sessionId}/seat-layout/ticket-drafts?userId=${userId}`)
}

export async function submitVenueApplication(body: Record<string, unknown>) {
  return request<import('@/types/api').VenueApplicationVO>('/api/ticket/admin/venue-applications', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function listMyVenueApplications(userId: number) {
  return request<import('@/types/api').VenueApplicationVO[]>(`/api/ticket/admin/venue-applications/my?userId=${userId}`)
}

export async function listVenueApplications(userId: number, status?: number) {
  const searchParams = new URLSearchParams({ userId: String(userId) })
  if (status !== undefined) searchParams.set('status', String(status))
  return request<import('@/types/api').VenueApplicationVO[]>(`/api/ticket/admin/venue-applications?${searchParams.toString()}`)
}

export async function reviewVenueApplication(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').VenueApplicationVO>(`/api/ticket/admin/venue-applications/${id}/review`, {
    method: 'POST', body: JSON.stringify(body),
  })
}
