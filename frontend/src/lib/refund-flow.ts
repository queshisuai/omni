import type { RefundRequestVO, RefundStatus } from '../types/api.ts'

export type RefundTimelineState = 'done' | 'active' | 'pending' | 'failed'

export interface RefundTimelineStep {
  label: string
  time: string | null
  state: RefundTimelineState
}

export interface RefundStatusMeta {
  label: string
  color: string
}

const REFUND_STATUS_META: Record<RefundStatus, RefundStatusMeta> = {
  0: { label: '退款待审核', color: '#fa8c16' },
  1: { label: '已退款', color: '#52c41a' },
  2: { label: '退款已拒绝', color: '#ff4d4f' },
  3: { label: '退款失败', color: '#ff4d4f' },
  4: { label: '退款处理中', color: '#1677ff' },
}

const UNKNOWN_REFUND_STATUS_META: RefundStatusMeta = {
  label: '退款状态同步中',
  color: '#1677ff',
}

export function getRefundStatusMeta(status: RefundStatus | number | null | undefined): RefundStatusMeta {
  return typeof status === 'number' && status in REFUND_STATUS_META
    ? REFUND_STATUS_META[status as RefundStatus]
    : UNKNOWN_REFUND_STATUS_META
}

export function isRefundActionBlockingStatus(status: RefundStatus | number | null | undefined) {
  return status !== 2 && status !== 3
}

export function buildRefundTimeline(refund: RefundRequestVO): RefundTimelineStep[] {
  const knownStatus = refund.status in REFUND_STATUS_META
  const reviewState: RefundTimelineState = !knownStatus ? 'active' : refund.status === 2 || refund.status === 3 ? 'failed' : refund.status === 0 ? 'active' : 'done'
  const refundState: RefundTimelineState = refund.status === 1 ? 'done' : refund.status === 3 ? 'failed' : refund.status === 4 ? 'active' : 'pending'
  return [
    { label: '已提交申请', time: refund.createTime, state: 'done' },
    { label: !knownStatus ? '退款状态同步中' : refund.status === 2 ? '审核已拒绝' : '平台审核', time: refund.reviewTime || (!knownStatus ? refund.createTime : null), state: reviewState },
    { label: refund.status === 3 ? '退款失败' : '原路退回', time: refund.refundTime, state: refundState },
  ]
}

export function getRefundSupportCopy(refund: RefundRequestVO | null | undefined) {
  if (!refund) return null
  if (refund.status === 3) return '退款失败，可联系人工客服介入处理'
  if (refund.status === 4) return '退款处理中超过预期时，可联系人工客服查询'
  if (!(refund.status in REFUND_STATUS_META)) return '退款状态同步中，可联系人工客服查询'
  return null
}
