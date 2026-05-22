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
  role: UserRole
}

/** 注册请求 */
export interface RegisterRequest {
  phone: string
  password: string
  confirmPassword: string
}

/** 找回密码重置请求 */
export interface ResetPasswordRequest {
  phone: string
  smsCode: string
  newPassword: string
  confirmPassword: string
}

/** 修改密码请求 */
export interface ChangePasswordRequest {
  oldPassword: string
  smsCode: string
  newPassword: string
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
  role: UserRole
  organizerStatus: OrganizerStatus | null
  organizerName: string | null
  createTime: string
  updateTime: string | null
}

export interface AssetUploadVO {
  id: number
  bizType: string
  publicUrl: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
}

export type UserRole = 'user' | 'organizer' | 'admin'
export type OrganizerApplicationStatus = 0 | 1 | 2
export type OrganizerStatus = 0 | 1 | 2 | 3
export type SubjectType = 'personal' | 'enterprise'

export interface OrganizerApplicationVO {
  id: number
  userId: number
  phone: string | null
  nickname: string | null
  role: UserRole | null
  organizerStatus: OrganizerStatus | null
  organizerName: string
  subjectType: SubjectType
  contactName: string
  contactPhone: string
  contactEmail: string | null
  licenseNo: string | null
  businessScope: string | null
  description: string | null
  status: OrganizerApplicationStatus
  reviewerId: number | null
  reviewNote: string | null
  createTime: string
  updateTime: string | null
  reviewTime: string | null
}

// ========== 票务/活动 ==========

export type ActivityArtistVisibility = 'public' | 'hidden'
export type ArtistReviewStatus = 'pending' | 'approved' | 'rejected'
export type ArtistRiskStatus = 'normal' | 'risky'

export interface ActivityArtistVO {
  artistId: number
  name?: string | null
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  categoryTags?: string | null
  avatar?: string | null
  isPrimary?: boolean | null
  primary?: boolean | null
  roleType?: string | null
  roleName?: string | null
  visibility: ActivityArtistVisibility
  sort: number
}

export interface ArtistSearchVO {
  id: number
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  categoryTags?: string | null
  avatar?: string | null
  representativeWorks?: string | null
  reviewStatus?: ArtistReviewStatus | string | null
  reviewNote?: string | null
  riskStatus?: ArtistRiskStatus | string | null
}

export interface ArtistSubmissionRequest {
  userId: number
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  agency?: string | null
  representativeWorks?: string | null
  categoryTags?: string | null
  description?: string | null
  sourceNote?: string | null
}

export interface ArtistReviewRequest {
  userId: number
  action: 'approve' | 'reject'
  note?: string | null
}

export interface ArtistRiskRequest {
  userId: number
  riskStatus: ArtistRiskStatus
  reason?: string | null
}

export interface ActivityRiskResolutionRequest {
  userId: number
  resolutionNote?: string | null
}

export interface ActivityRiskResolutionReviewRequest {
  userId: number
  action: 'approve' | 'reject'
  reviewNote?: string | null
}

export interface ActivityRiskResolutionVO {
  id: number
  activityId: number
  organizerId: number
  riskArtistId?: number | null
  status: 'pending' | 'approved' | 'rejected' | string
  resolutionNote?: string | null
  reviewNote?: string | null
  submittedBy?: number | null
  reviewedBy?: number | null
  reviewedAt?: string | null
}

export interface NotificationVO {
  id: number
  userId: number
  orderId?: number | null
  type: string
  content: string
  status: number
  createTime?: string | null
}

export interface ActivityRiskCaseVO {
  activityId: number
  activityName: string
  organizerId: number
  riskSuspendedReason?: string | null
  riskSuspendedAt?: string | null
  latestResolutionId?: number | null
  latestResolutionStatus?: string | null
  latestResolutionNote?: string | null
  latestSubmittedBy?: number | null
}

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
  artists?: ActivityArtistVO[]
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
  artistName?: string | null
  artists?: ActivityArtistVO[]
  organizerId?: number | null
  venueApplicationId?: number | null
  venueApprovalNo?: string | null
  venueApprovalFileUrl?: string | null
  venueApprovalNote?: string | null
  name: string
  description: string | null
  poster: string
  publishStatus?: string | null
  riskSuspendedReason?: string | null
  riskSuspendedAt?: string | null
  riskRestoredAt?: string | null
  seatMapVisibility?: 'published' | 'hidden' | null
  status: number
  createTime: string
}

export interface DeleteActivityResponse {
  activityId: number
  publishStatus: string
  status: number
  deleted: boolean
  refundBlocked: boolean
  message?: string
}

/** 艺人 */
export interface ArtistEntity {
  id: number
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  categoryTags?: string | null
  representativeWorks?: string | null
  reviewStatus?: ArtistReviewStatus | string | null
  reviewNote?: string | null
  submittedBy?: number | null
  reviewedBy?: number | null
  reviewedAt?: string | null
  riskStatus?: ArtistRiskStatus | string | null
  riskReason?: string | null
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

export interface SessionAdminVO extends SessionEntity {
  activityName: string | null
  venueName: string | null
  venueCity: string | null
  ticketTypeCount: number
  totalStock: number
  soldStock: number
  remainStock: number
  ticketTypes?: TicketTypeEntity[]
}

export interface AdminSummaryVO {
  activityCount: number
  ticketTypeCount: number
  paidOrderCount: number
}

export interface TourEntity {
  id: number
  title: string
  artistId?: number | null
  categoryId?: number | null
  poster?: string | null
  description?: string | null
  organizerId: number
  reviewStatus: string
  status: number
  createTime?: string | null
  updateTime?: string | null
}

export type StationPublishStatus =
  | 'draft'
  | 'city_announced'
  | 'venue_pending'
  | 'venue_rejected'
  | 'venue_approved'
  | 'publishing'
  | 'published'
  | 'risk_suspended'
  | 'cancelled'
  | string

export type StationSaleStatus =
  | 'unannounced'
  | 'coming_soon'
  | 'to_be_scheduled'
  | 'on_sale'
  | 'sold_out'
  | 'suspended'
  | string

export interface StationEntity {
  id: number
  tourId: number
  city: string
  stationName: string
  poster?: string | null
  description?: string | null
  venueApplicationId?: number | null
  publishStatus: StationPublishStatus
  status: number
  createTime?: string | null
  updateTime?: string | null
}

export interface TourDetailVO {
  tour: TourEntity
  stations: StationEntity[]
  stationDetails?: StationPurchaseDetail[]
}

export interface TourAdminDetailVO extends TourDetailVO {
  stationDetails: StationPurchaseDetail[]
}

export interface StationPurchaseDetail {
  station: StationEntity
  activity?: ActivityEntity | null
  sessions: SessionEntity[]
  venueName?: string | null
  venueAddress?: string | null
  priceMin?: number | null
  priceMax?: number | null
  remainStock?: number | null
  saleStatus?: StationSaleStatus | null
  saleStatusText?: string | null
  primaryAction?: 'buy' | 'none' | null
}

/** 场馆 */
export interface VenueEntity {
  id: number
  name: string
  address: string
  city: string
  capacity?: number | null
  status?: number
}

export type VenueApplicationStatus = 0 | 1 | 2

export interface VenueApplicationVO {
  id: number
  applicantId: number
  venueId: number | null
  venueName: string
  city: string
  address: string
  capacity: number | null
  contactName: string
  contactPhone: string
  qualificationNo: string | null
  businessScope: string | null
  description: string | null
  validFrom?: string | null
  validTo?: string | null
  proofNote?: string | null
  proofFileUrl?: string | null
  status: VenueApplicationStatus
  reviewerId: number | null
  reviewNote: string | null
  createTime: string
  updateTime: string | null
  reviewTime: string | null
}

export interface VenueAreaVO {
  id: number
  venueId: number
  name: string
  rowCount: number
  seatsPerRow: number
  rowStart: number
  seatStart: number
  color: string | null
  sort: number
  status: number
}

export interface VenueSeatVO {
  id: number
  venueId: number
  areaId: number
  rowNo: number
  seatNo: number
  seatLabel?: string | null
  x?: number | null
  y?: number | null
  status: number
  createTime?: string | null
}

export interface VenueSeatRequest {
  userId: number
  venueId?: number
  areaId: number
  rowNo: number
  seatNo: number
  seatLabel?: string | null
  x?: number | null
  y?: number | null
  status: number
}

export interface SeatTemplateSyncResponseVO {
  syncedSessionCount: number
  skippedSessionCount: number
  skippedSessionIds: number[]
}

export interface SessionAreaStockVO extends VenueAreaVO {
  availableSeatCount: number
}

export interface SessionSeatVO {
  id: number
  sessionId: number
  venueId: number
  areaId: number
  venueSeatId: number
  rowNo: number
  seatNo: number
  seatLabel: string
  status: number
  lockExpireTime: string | null
  orderId: number | null
  ticketTypeId: number | null
  layoutSectionId?: number | null
  seatBlockId?: number | null
  ticketGroupKey?: string | null
  generatedRowNo?: number | null
  generatedSeatNo?: number | null
}

export type SeatCraftTemplateType = 'concert' | 'cinema' | 'custom'
export type SeatCraftSectionType = 'core' | 'stand' | 'zone'
export type SeatCraftSectionLayout = 'grid' | 'curved'
export type SeatCraftBlockType = 'gridBlock' | 'arcBlock' | 'standingBlock'

export interface SeatCraftBlockVO {
  id: string | number
  blockKey: string
  name: string
  blockType: SeatCraftBlockType
  ticketGroupKey: string
  x: number
  y: number
  rotation: number
  scale: number
  rows?: number | null
  cols?: number | null
  seatsPerRow?: number | null
  rowSpacing?: number | null
  seatSpacing?: number | null
  innerRadius?: number | null
  arcStartAngle?: number | null
  arcEndAngle?: number | null
  width?: number | null
  height?: number | null
  capacity?: number | null
  color: string
  sort: number
}

export interface SeatOverrideVO {
  blockKey: string
  rowNo: number
  seatNo: number
  status: 'visible' | 'hidden' | 'deleted'
  dx?: number | null
  dy?: number | null
  customLabel?: string | null
}

export interface TicketGroupVO {
  groupKey: string
  name: string
  defaultPrice?: number | null
  activityPrice?: number | null
  sourceBlockKeys: string[]
  sort: number
}

export interface SeatCraftSectionVO {
  id: number
  sectionKey: string
  name: string
  rows: number
  cols: number
  x: number
  y: number
  color: string
  type: SeatCraftSectionType
  layout: SeatCraftSectionLayout
  radius?: number | null
  arcSpan?: number | null
  rotation?: number | null
  primeRowStart?: number | null
  primeRowEnd?: number | null
  primeColStart?: number | null
  primeColEnd?: number | null
  seatCount?: number | null
  ticketTypeId?: number | null
  price?: number | null
}

export interface SeatCraftLayoutVO {
  id: number
  venueId?: number | null
  activityId?: number | null
  sessionId?: number | null
  name: string
  templateType: SeatCraftTemplateType
  stageTitle: string
  stageX: number
  stageY: number
  canvasWidth: number
  canvasHeight: number
  sections: SeatCraftSectionVO[]
  blocks?: SeatCraftBlockVO[]
  overrides?: SeatOverrideVO[]
  ticketGroups?: TicketGroupVO[]
  blockLayout?: {
    name?: string | null
    canvasWidth?: number | null
    canvasHeight?: number | null
    blocks?: SeatCraftBlockVO[]
    overrides?: SeatOverrideVO[]
    ticketGroups?: TicketGroupVO[]
  } | null
}

export interface SeatLayoutTemplateCandidateVO {
  sourceType: 'venue_application' | 'legacy_venue_default'
  sourceId: number
  name: string
  createTime?: string | null
  layout: SeatCraftLayoutVO
}

export interface SeatMapResponse {
  sessionId: number
  ticketTypeId: number
  ticketTypeName: string
  price: number
  stageLabel: string
  areas: VenueAreaVO[]
  seats: SessionSeatVO[]
  layout?: SeatCraftLayoutVO | null
}

export interface SeatTemplateResponse {
  area: VenueAreaVO
  generatedSeatCount: number
  syncResult?: SeatTemplateSyncResponseVO | null
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

export interface AdminTicketTypeCreateRequest {
  userId: number
  sessionId: number
  name: string
  price: number
  totalStock?: number
  layoutSectionIds?: number[]
  sourceBlockKeys?: string[]
  areaIds?: number[]
}

export interface SessionTicketBindingRequest {
  userId: number
  bindings: Array<{
    ticketTypeId: number
    blockKeys: string[]
  }>
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
  artists?: ActivityArtistVO[]
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
  userHidden?: boolean | null
  userDeletedAt?: string | null
  userDeleteExpiresAt?: string | null
  createTime: string
  activityId?: number | null
  activityName?: string | null
  activityPoster?: string | null
  venueName?: string | null
  sessionTime?: string | null
  ticketName?: string | null
  unitPrice?: number | null
  seatLabels?: string | null
}

export interface PagePayResponse {
  orderId: number
  orderNo: string
  payForm: string
}

export interface QrPayResponse {
  orderId: number
  orderNo: string
  amount: number
  subject: string
  qrCode: string
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

export interface DirectRefundResponse {
  orderId: number | null
  orderNo: string | null
  status: 'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'COMPENSATION_REQUIRED'
  success: boolean
  message: string | null
}

export interface RefundImpactResponse {
  activityId: number
  activityName: string
  deactivatedActivityCount: number
  deactivatedSessionCount: number
  deactivatedTicketTypeCount: number
  paidOrderCount: number
  refundSuccessCount: number
  refundFailedCount: number
  refundUnknownCount: number
  refundCompensationRequiredCount: number
  failures: DirectRefundResponse[]
}

export interface DeactivateOrganizerRequest {
  userId: number
  organizerId: number
  confirmRefund: boolean
  reason?: string
}
