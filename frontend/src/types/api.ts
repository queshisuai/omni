/**
 * 后端接口响应类型
 */

/** 统一响应体 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 登录请求 */
export interface LoginRequest {
  loginType: 'password' | 'sms'
  account: string
  password?: string
  smsCode?: string
}

/** 登录响应 */
export interface LoginResponse {
  userId: number
  phone: string
  nickname: string | null
  token: string
  role: string
}

/** 注册请求 */
export interface RegisterRequest {
  phone: string
  password: string
  confirmPassword: string
}

/** 用户信息 */
export interface UserInfo {
  id: number
  phone: string
  nickname: string | null
  email: string | null
  avatar: string | null
  status: number
  createTime: string
}

// ========== 票务/活动 ==========

/** 分页结果 */
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

/** 活动列表项 */
export interface ActivityVO {
  id: number
  name: string
  poster: string
  categoryName: string
  artistName: string
  venueCity: string
  startTime: string
  minPrice: number | null
  status: number
}

/** 分类 */
export interface CategoryVO {
  id: number
  name: string
  icon: string | null
  sort: number
  status: number
}

/** 活动实体 */
export interface ActivityEntity {
  id: number
  categoryId: number
  artistId: number
  name: string
  description: string | null
  poster: string
  status: number
  createTime: string
}

/** 艺人 */
export interface ArtistEntity {
  id: number
  name: string
  avatar: string | null
  description: string | null
}

/** 场次 */
export interface SessionEntity {
  id: number
  activityId: number
  venueId: number
  startTime: string
  endTime: string
  status: number
}

/** 场馆 */
export interface VenueEntity {
  id: number
  name: string
  address: string
  city: string
}

/** 票档 */
export interface TicketTypeEntity {
  id: number
  sessionId: number
  name: string
  price: number
  totalStock: number
  remainStock: number
  status: number
}

/** 场次详情（含票档和场馆） */
export interface SessionDetail {
  session: SessionEntity
  venue: VenueEntity
  ticketTypes: TicketTypeEntity[]
}

/** 活动详情 */
export interface ActivityDetailVO {
  activity: ActivityEntity
  category: CategoryVO
  artist: ArtistEntity
  sessions: SessionDetail[]
}

/** 预约 */
export interface ReservationEntity {
  id: number
  userId: number
  sessionId: number
  createTime: string
}

/** 订单 */
export interface OrderEntity {
  id: number
  orderNo: string
  userId: number
  sessionId: number
  ticketTypeId: number
  quantity: number
  amount: number
  status: number
  createTime: string
}

/** 评价 */
export interface ReviewEntity {
  id: number
  activityId: number
  userId: number
  orderId: number | null
  rating: number
  content: string | null
  images: string | null
  likeCount: number
  status: number
  createTime: string
}

/** 动态 */
export interface MomentEntity {
  id: number
  userId: number
  activityId: number | null
  content: string
  images: string | null
  likeCount: number
  commentCount: number
  status: number
  createTime: string
}

export interface PagePayResponse {
  orderId: number
  orderNo: string
  payForm: string
}

export interface PaymentStatusResponse {
  orderId: number
  orderNo: string
  orderStatus: number
  paymentStatus: number
  tradeNo: string | null
  message: string
}

export type RefundStatus = 0 | 1 | 2 | 3 | 4

export interface RefundRequestVO {
  id: number
  orderId: number
  orderNo: string
  userId: number
  paymentId: number
  refundNo: string
  amount: number
  reason: string | null
  status: RefundStatus
  reviewerId: number | null
  reviewNote: string | null
  alipayRefundNo: string | null
  createTime: string
  reviewTime: string | null
  refundTime: string | null
}
