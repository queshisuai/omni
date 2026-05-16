/**
 * API 客户端 - fetch 封装
 */
import { getToken } from './auth'
import type { ApiResult } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}

let offlineUntil = 0

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (Date.now() < offlineUntil) {
    throw new ApiError(503, '服务暂不可用，使用离线模式')
  }

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
    offlineUntil = Date.now() + 5000 // 发生网络错误，5秒内直接走离线模式
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
  return request<{ userId: number; phone: string; nickname: string | null; token: string; role?: string }>(
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

export async function getUserInfo(userId: number) {
  return request<{ id: number; phone: string; nickname: string | null; email: string | null; avatar: string | null }>(
    `/api/user/info?userId=${userId}`
  )
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

export async function listCategories() {
  return request<import('@/types/api').CategoryVO[]>('/api/ticket/categories')
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

export async function listOrders(userId: number) {
  return request<import('@/types/api').OrderEntity[]>(`/api/order/user/${userId}`)
}

export async function getOrderDetail(id: number) {
  return request<import('@/types/api').OrderEntity>(`/api/order/${id}`)
}

export async function cancelOrder(id: number) {
  return request<void>(`/api/order/${id}`, { method: 'DELETE' })
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

// ========== 主办方申请 ==========

export async function applyOrganizer(userId: number, organizerName: string) {
  return request<import('@/types/api').UserInfo>('/api/user/organizer/apply', {
    method: 'POST',
    body: JSON.stringify({ userId, organizerName }),
  })
}

// ========== B端管理接口 ==========

export async function listAdminActivities(userId: number, page = 1, size = 10) {
  return request<import('@/types/api').PageResult<import('@/types/api').ActivityEntity>>(
    `/api/ticket/admin/activities?userId=${userId}&page=${page}&size=${size}`
  )
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

export async function deleteAdminActivity(id: number, userId: number) {
  return request<void>(`/api/ticket/admin/activities/${id}?userId=${userId}`, { method: 'DELETE' })
}

export async function createAdminSession(body: Record<string, unknown>) {
  return request<import('@/types/api').SessionEntity>('/api/ticket/admin/sessions', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateAdminSession(id: number, body: Record<string, unknown>) {
  return request<import('@/types/api').SessionEntity>(`/api/ticket/admin/sessions/${id}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deleteAdminSession(id: number, userId: number) {
  return request<void>(`/api/ticket/admin/sessions/${id}?userId=${userId}`, { method: 'DELETE' })
}

export async function createAdminTicketType(body: Record<string, unknown>) {
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

// ========== 评价 ==========

export async function listReviews(activityId: number, page = 1, size = 10) {
  return request<import('@/types/api').PageResult<import('@/types/api').ReviewEntity>>(
    `/api/ticket/activities/${activityId}/reviews?page=${page}&size=${size}`
  )
}

export async function createReview(body: Record<string, unknown>) {
  return request<import('@/types/api').ReviewEntity>('/api/ticket/reviews', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function deleteReview(id: number) {
  return request<void>(`/api/ticket/reviews/${id}`, { method: 'DELETE' })
}

// ========== 动态 ==========

export async function listMoments(activityId: number, page = 1, size = 10) {
  return request<import('@/types/api').PageResult<import('@/types/api').MomentEntity>>(
    `/api/ticket/activities/${activityId}/moments?page=${page}&size=${size}`
  )
}

export async function createMoment(body: Record<string, unknown>) {
  return request<import('@/types/api').MomentEntity>('/api/ticket/moments', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function deleteMoment(id: number) {
  return request<void>(`/api/ticket/moments/${id}`, { method: 'DELETE' })
}
